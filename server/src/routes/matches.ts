import { Router, Response } from 'express';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/matches - Get all matches for current user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;
    
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }]
      },
      include: {
        user1: { select: { id: true, name: true, profilePhoto: true, photos: true, bio: true, age: true } },
        user2: { select: { id: true, name: true, profilePhoto: true, photos: true, bio: true, age: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true }
        }
      }
    });

    const mappedMatches = matches.map(m => {
      const isUser1 = m.user1Id === userId;
      const matchedUser = isUser1 ? m.user2 : m.user1;
      const lastMessage = m.messages.length > 0 ? m.messages[0] : null;
      const userPhotos: string[] = JSON.parse(matchedUser.photos || '[]');
      const rawPhoto = matchedUser.profilePhoto || userPhotos[0] || '';
      const profilePhoto = rawPhoto ? rawPhoto.replace(/=s\d+(-c)?$/, '=s800-c') : '';

      return {
        matchId: m.id,
        matchedAt: m.createdAt,
        isSuper: m.isSuper,
        userId: matchedUser.id,
        name: matchedUser.name,
        profilePhoto,
        bio: matchedUser.bio,
        age: matchedUser.age,
        lastMessage: lastMessage?.content || null,
        lastMessageAt: lastMessage?.createdAt || null
      };
    });

    // Sort by lastMessageAt descending, then by matchedAt descending
    mappedMatches.sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.matchedAt).getTime();
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.matchedAt).getTime();
      return bTime - aTime;
    });

    res.json(mappedMatches);
  } catch (error) {
    console.error('Matches error:', error);
    res.status(500).json({ error: 'Erro interno ao buscar matches' });
  }
});

// POST /api/matches/admin/chat/:targetUserId - Admin can open/create a test chat with any user
router.post('/admin/chat/:targetUserId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;
    const targetUserId = parseInt(req.params.targetUserId);

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (currentUser?.email?.toLowerCase() !== 'steven35silva@gmail.com') {
      return res.status(403).json({ error: 'Acesso exclusivo do administrador' });
    }

    if (userId === targetUserId) {
      return res.status(400).json({ error: 'Selecione outro usuário para testar o chat' });
    }

    let match = await prisma.match.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: targetUserId },
          { user1Id: targetUserId, user2Id: userId }
        ]
      }
    });

    if (!match) {
      match = await prisma.match.create({
        data: {
          user1Id: userId,
          user2Id: targetUserId,
          isSuper: false
        }
      });
    }

    res.json({ matchId: match.id });
  } catch (error) {
    console.error('Admin start chat error:', error);
    res.status(500).json({ error: 'Erro ao iniciar chat de teste' });
  }
});

// DELETE /api/matches/:matchId - Unmatch with a user (deletes match, messages, and likes)
router.delete('/:matchId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;
    const matchId = parseInt(req.params.matchId);

    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [{ user1Id: userId }, { user2Id: userId }]
      }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match não encontrado' });
    }

    const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;

    await prisma.$transaction([
      prisma.message.deleteMany({
        where: { matchId }
      }),
      prisma.match.delete({
        where: { id: matchId }
      }),
      prisma.swipe.deleteMany({
        where: {
          OR: [
            { swiperId: userId, swipedId: otherUserId },
            { swiperId: otherUserId, swipedId: userId }
          ]
        }
      }),
      prisma.swipe.create({
        data: {
          swiperId: userId,
          swipedId: otherUserId,
          direction: 'dislike'
        }
      })
    ]);

    res.json({ success: true, otherUserId });
  } catch (error) {
    console.error('Unmatch error:', error);
    res.status(500).json({ error: 'Erro ao desfazer match' });
  }
});

export default router;
