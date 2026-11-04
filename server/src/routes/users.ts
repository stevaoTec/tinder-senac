import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Haversine formula to calculate distance between two lat/lng points in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return Math.round(R * c); // Distance in km
}

// Multer configuration - Memory storage to save photos as Base64 in the database
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

const profileSchema = z.object({
  name: z.string().optional(),
  bio: z.string().optional(),
  age: z.number().optional(),
  gender: z.string().optional(),
  interests: z.array(z.string()).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  maxDistance: z.number().optional(),
  minAge: z.number().optional(),
  maxAge: z.number().optional(),
  genderPreference: z.string().optional(),
  relationshipIntent: z.string().optional(),
  zodiacSign: z.string().optional(),
  height: z.number().optional(),
  mbti: z.string().optional(),
  instagram: z.string().optional(),
  spotify: z.string().optional(),
  favoritePlace: z.string().optional(),
  currentEvent: z.string().optional()
});

// GET /api/users/discover - Get users for swiping with Affinity and Real Location
router.get('/discover', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;
    
    // Get current user to compare interests and location
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { interests: true, latitude: true, longitude: true, maxDistance: true, minAge: true, maxAge: true, genderPreference: true }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const currentUserInterests = JSON.parse(currentUser.interests || '[]');
    const lat1 = currentUser.latitude;
    const lon1 = currentUser.longitude;
    const maxDist = currentUser.maxDistance || 50;
    const minAge = currentUser.minAge || 18;
    const maxAge = currentUser.maxAge || 100;
    const genderPreference = currentUser.genderPreference || 'Todos';

    // Get IDs of users already swiped
    const swipes = await prisma.swipe.findMany({
      where: { swiperId: userId },
      select: { swipedId: true }
    });
    const swipedIds = swipes.map(s => s.swipedId);
    swipedIds.push(userId); // Exclude self

    const users = await prisma.user.findMany({
      where: {
        id: { notIn: swipedIds },
        age: { gte: minAge, lte: maxAge },
        profilePhoto: { not: '' },
        name: { not: '' },
        ...(genderPreference !== 'Todos' ? { gender: genderPreference } : {})
      },
      select: {
        id: true, name: true, bio: true, age: true, gender: true,
        profilePhoto: true, coverPhoto: true, photos: true, interests: true,
        verified: true, latitude: true, longitude: true,
        relationshipIntent: true, zodiacSign: true, height: true, mbti: true, 
        instagram: true, spotify: true, vibeScore: true, favoritePlace: true, currentEvent: true
      }
    });

    const mappedUsers = users.map(u => {
      const photos = JSON.parse(u.photos || '[]');
      const userInterests = JSON.parse(u.interests || '[]');
      
      let affinityScore = 0;
      if (currentUserInterests.length > 0 && userInterests.length > 0) {
        affinityScore = userInterests.filter((interest: string) => currentUserInterests.includes(interest)).length;
      }

      let distance = Math.floor(Math.random() * 15) + 1;
      if (lat1 && lon1 && u.latitude && u.longitude) {
        distance = calculateDistance(lat1, lon1, u.latitude, u.longitude);
      }

      return {
        id: u.id,
        name: u.name,
        bio: u.bio,
        age: u.age,
        gender: u.gender,
        profilePhoto: u.profilePhoto,
        coverPhoto: u.coverPhoto,
        photos,
        interests: userInterests,
        verified: Boolean(u.verified),
        relationshipIntent: u.relationshipIntent,
        zodiacSign: u.zodiacSign,
        height: u.height,
        mbti: u.mbti,
        instagram: u.instagram,
        spotify: u.spotify,
        vibeScore: u.vibeScore,
        favoritePlace: u.favoritePlace,
        currentEvent: u.currentEvent,
        affinityScore,
        distance
      };
    });

    const filteredUsers = maxDist >= 500 ? mappedUsers : mappedUsers.filter(u => u.distance <= maxDist);

    filteredUsers.sort((a, b) => {
      if (b.affinityScore !== a.affinityScore) {
        return b.affinityScore - a.affinityScore;
      }
      return a.distance - b.distance;
    });

    res.json(filteredUsers.slice(0, 20));
  } catch (err) {
    console.error('Discover error:', err);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// PUT /api/users/profile - Update profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = profileSchema.parse(req.body);
    const userId = req.userId as number;

    const updateData: any = { ...validatedData };
    if (updateData.interests) {
      updateData.interests = JSON.stringify(updateData.interests);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    const { password: _, ...userWithoutPassword } = user;
    const mappedUser = {
      ...userWithoutPassword,
      photos: JSON.parse(user.photos || '[]'),
      interests: JSON.parse(user.interests || '[]'),
      verified: Boolean(user.verified)
    };

    res.json(mappedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: (error as any).errors[0].message });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/users/profile/photo - Upload profile photo (saved as Base64 in DB)
router.post('/profile/photo', authenticateToken, upload.single('profilePhoto'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  try {
    const photoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const userId = req.userId as number;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { photos: true }
    });

    const existingPhotos: string[] = JSON.parse(user?.photos || '[]');
    const photos = [photoUrl, ...existingPhotos.filter(p => p !== photoUrl)].slice(0, 5);

    await prisma.user.update({
      where: { id: userId },
      data: {
        profilePhoto: photoUrl,
        photos: JSON.stringify(photos)
      }
    });

    res.json({ profilePhoto: photoUrl, photos });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/users/profile/cover - Upload cover photo (saved as Base64 in DB)
router.post('/profile/cover', authenticateToken, upload.single('coverPhoto'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  try {
    const coverUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const userId = req.userId as number;
    
    await prisma.user.update({
      where: { id: userId },
      data: { coverPhoto: coverUrl }
    });

    res.json({ coverPhoto: coverUrl });
  } catch (error) {
    console.error('Cover upload error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/users/admin/stats
router.get('/admin/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email !== 'steven35silva@gmail.com') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const totalUsers = await prisma.user.count();
    const { getOnlineUsersCount } = require('../socket/chat');
    
    res.json({ 
      totalUsers, 
      onlineUsers: getOnlineUsersCount() 
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true, name: true, bio: true, age: true, gender: true,
        profilePhoto: true, coverPhoto: true, photos: true, interests: true,
        verified: true, maxDistance: true,
        relationshipIntent: true, zodiacSign: true, height: true, mbti: true, instagram: true, spotify: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const mappedUser = {
      ...user,
      photos: JSON.parse(user.photos || '[]'),
      interests: JSON.parse(user.interests || '[]'),
      verified: Boolean(user.verified)
    };

    res.json(mappedUser);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
