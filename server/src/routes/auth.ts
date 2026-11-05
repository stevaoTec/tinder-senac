import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../database/prisma';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth';
import { markUserActive } from '../socket/chat';

const router = Router();

// CPF validation function
function validateCPF(cpf: string): boolean {
  if (!cpf) return false;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[10])) return false;

  return true;
}

const registerSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  name: z.string().min(2, 'O nome e obrigatorio e deve ter mais de 1 caractere'),
  cpf: z.string().refine(validateCPF, 'CPF invalido'),
  age: z.number().min(18, 'Voce deve ter pelo menos 18 anos para se cadastrar').default(18),
  gender: z.string().optional().default('')
});

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'A senha e obrigatoria')
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { email, password, name, cpf, age, gender } = validatedData;
    const cleanCpf = cpf.replace(/\D/g, '');

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { cpf: cleanCpf }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'Este email ja esta cadastrado' });
      }
      return res.status(400).json({ error: 'Este CPF ja esta cadastrado' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        cpf: cleanCpf,
        age,
        gender,
        profilePhoto: '',
        photos: JSON.stringify([]),
        interests: JSON.stringify([]),
        verified: 0
      }
    });

    const token = generateToken(user.id);
    markUserActive(user.id);
    
    const { password: _, ...userWithoutPassword } = user;
    const mappedUser = {
      ...userWithoutPassword,
      photos: JSON.parse(user.photos || '[]'),
      interests: JSON.parse(user.interests || '[]'),
      verified: Boolean(user.verified)
    };

    res.status(201).json({ token, user: mappedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: (error as any).errors[0].message });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Email ou senha invalidos' });
    }

    const token = generateToken(user.id);
    markUserActive(user.id);
    const { password: _, ...userWithoutPassword } = user;
    
    const mappedUser = {
      ...userWithoutPassword,
      photos: JSON.parse(user.photos || '[]'),
      interests: JSON.parse(user.interests || '[]'),
      verified: Boolean(user.verified)
    };

    res.json({ token, user: mappedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: (error as any).errors[0].message });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/google - Google OAuth login/register
router.post('/google', async (req: Request, res: Response) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Token do Google nao fornecido' });
  }

  try {
    const parts = credential.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Token do Google invalido' });
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const { email, name, picture, sub: googleId } = payload;
    const highResPicture = picture ? picture.replace(/=s\d+(-c)?$/, '=s800-c') : '';

    if (!email) {
      return res.status(400).json({ error: 'Email nao encontrado no token do Google' });
    }

    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (user) {
      // Existing user - login (and upgrade blurry Google =s96-c avatar if needed)
      const needsPhotoUpgrade = highResPicture && (!user.profilePhoto || user.profilePhoto.includes('=s96-c'));
      if (!user.googleId || needsPhotoUpgrade) {
        const currentPhotos: string[] = JSON.parse(user.photos || '[]');
        const updatedPhotos = needsPhotoUpgrade
          ? [highResPicture, ...currentPhotos.filter(p => !p.includes('=s96-c'))]
          : currentPhotos;
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: user.googleId || googleId,
            ...(needsPhotoUpgrade ? { profilePhoto: highResPicture, photos: JSON.stringify(updatedPhotos) } : {})
          }
        });
      }
      const token = generateToken(user.id);
      markUserActive(user.id);
      const { password: _, ...userWithoutPassword } = user;
      
      const mappedUser = {
        ...userWithoutPassword,
        photos: JSON.parse(user.photos || '[]'),
        interests: JSON.parse(user.interests || '[]'),
        verified: Boolean(user.verified)
      };
      return res.json({ token, user: mappedUser });
    } else {
      // New user - register via Google
      const avatarUrl = highResPicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || email)}`;
      const randomPassword = bcrypt.hashSync(Math.random().toString(36), 10);

      const newUser = await prisma.user.create({
        data: {
          email,
          password: randomPassword,
          name: name || email.split('@')[0],
          age: 18,
          gender: '',
          profilePhoto: avatarUrl,
          photos: JSON.stringify([avatarUrl]),
          interests: JSON.stringify([]),
          verified: 1,
          googleId
        }
      });

      const token = generateToken(newUser.id);
      markUserActive(newUser.id);
      
      const { password: _, ...userWithoutPassword } = newUser;
      const mappedUser = {
        ...userWithoutPassword,
        photos: JSON.parse(newUser.photos || '[]'),
        interests: JSON.parse(newUser.interests || '[]'),
        verified: Boolean(newUser.verified)
      };

      return res.status(201).json({ token, user: mappedUser });
    }
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Erro ao autenticar com Google' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    markUserActive(user.id);

    const { password: _, ...userWithoutPassword } = user;
    const mappedUser = {
      ...userWithoutPassword,
      photos: JSON.parse(user.photos || '[]'),
      interests: JSON.parse(user.interests || '[]'),
      verified: Boolean(user.verified)
    };

    res.json(mappedUser);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
