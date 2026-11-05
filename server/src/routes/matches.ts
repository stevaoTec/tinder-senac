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

export default router;
