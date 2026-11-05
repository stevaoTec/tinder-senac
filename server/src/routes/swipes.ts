import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const swipeSchema = z.object({
  targetUserId: z.number(),
  direction: z.enum(['like', 'dislike', 'superlike'])
});

function formatUserCard(u: any) {
  const photos: string[] = JSON.parse(u.photos || '[]').map((p: string) =>
    p.replace(/=s\d+(-c)?$/, '=s800-c')
  );
  const rawProfilePhoto = u.profilePhoto || photos[0] || '';
  const profilePhoto = rawProfilePhoto ? rawProfilePhoto.replace(/=s\d+(-c)?$/, '=s800-c') : '';

  return {
    id: u.id,
    name: u.name,
    bio: u.bio,
    age: u.age,
    gender: u.gender,
    profilePhoto,
    coverPhoto: u.coverPhoto,
    photos,
    interests: JSON.parse(u.interests || '[]'),
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
    distance: 1
  };
}

// POST /api/swipes - Swipe on a user (supports updating a previous dislike to like)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { targetUserId, direction } = swipeSchema.parse(req.body);
    const userId = req.userId as number;

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Você não pode curtir a si mesmo' });
    }

    // Upsert swipe so a rewound or changed swipe never fails
    await prisma.swipe.upsert({
      where: {
        swiperId_swipedId: {
          swiperId: userId,
          swipedId: targetUserId
        }
      },
      update: {
        direction,
        createdAt: new Date()
      },
      create: {
        swiperId: userId,
        swipedId: targetUserId,
        direction
      }
    });

    // Check for match if it was a like or superlike
    let matchResult = null;
    if (direction === 'like' || direction === 'superlike') {
      const mutualLike = await prisma.swipe.findFirst({
        where: {
          swiperId: targetUserId,
          swipedId: userId,
          direction: { in: ['like', 'superlike'] }
        }
      });

      if (mutualLike) {
        // Check if match already exists
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
              isSuper: direction === 'superlike' || mutualLike.direction === 'superlike'
            }
          });
        }

        const matchedUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, name: true, bio: true, age: true, profilePhoto: true, photos: true }
        });

        if (matchedUser) {
          const photos: string[] = JSON.parse(matchedUser.photos || '[]');
          const rawPhoto = matchedUser.profilePhoto || photos[0] || '';
          matchResult = {
            matchId: match.id,
            user: {
              ...matchedUser,
              profilePhoto: rawPhoto ? rawPhoto.replace(/=s\d+(-c)?$/, '=s800-c') : ''
            }
          };
        }
      }
    }

    res.json({ success: true, match: matchResult });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: (error as any).errors[0].message });
    }
    console.error('Swipe error:', error);
    res.status(500).json({ error: 'Erro interno ao realizar swipe' });
  }
});

// GET /api/swipes/disliked - List all users passed/disliked by current user
router.get('/disliked', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;

    const dislikedSwipes = await prisma.swipe.findMany({
      where: {
        swiperId: userId,
        direction: 'dislike'
      },
      orderBy: { createdAt: 'desc' },
      include: {
        swiped: {
          select: {
            id: true, name: true, bio: true, age: true, gender: true,
            profilePhoto: true, coverPhoto: true, photos: true, interests: true, verified: true,
            relationshipIntent: true, zodiacSign: true, height: true, mbti: true,
            instagram: true, spotify: true, vibeScore: true, favoritePlace: true, currentEvent: true,
            email: true
          }
        }
      }
    });

    const users = dislikedSwipes
      .filter(s => s.swiped && !s.swiped.email.endsWith('@demo.com'))
      .map(s => formatUserCard(s.swiped));

    res.json(users);
  } catch (error) {
    console.error('Get disliked users error:', error);
    res.status(500).json({ error: 'Erro ao buscar perfis recusados' });
  }
});

// POST /api/swipes/restore/:targetUserId - Restore a specific disliked user (or 'all') back to discover queue
router.post('/restore/:targetUserId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;
    const param = req.params.targetUserId;

    if (param === 'all') {
      await prisma.swipe.deleteMany({
        where: {
          swiperId: userId,
          direction: 'dislike'
        }
      });
      return res.json({ success: true, restoredAll: true });
    }

    const targetUserId = parseInt(param);
    await prisma.swipe.deleteMany({
      where: {
        swiperId: userId,
        swipedId: targetUserId
      }
    });

    const restoredUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    res.json({
      success: true,
      user: restoredUser ? formatUserCard(restoredUser) : null
    });
  } catch (error) {
    console.error('Restore swipe error:', error);
    res.status(500).json({ error: 'Erro ao restaurar perfil' });
  }
});

// DELETE /api/swipes/rewind - Undo the last dislike (or last swipe)
router.delete('/rewind', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;

    // Prioritize undoing the most recent dislike first; fallback to any recent swipe
    let lastSwipe = await prisma.swipe.findFirst({
      where: { swiperId: userId, direction: 'dislike' },
      orderBy: { createdAt: 'desc' }
    });

    if (!lastSwipe) {
      lastSwipe = await prisma.swipe.findFirst({
        where: { swiperId: userId },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!lastSwipe) {
      return res.status(400).json({ error: 'Nenhum perfil anterior para voltar' });
    }

    const { id: swipeId, swipedId, direction } = lastSwipe;

    // If it was a like/superlike, check if it created a match and delete it
    if (direction === 'like' || direction === 'superlike') {
      const match = await prisma.match.findFirst({
        where: {
          OR: [
            { user1Id: userId, user2Id: swipedId },
            { user1Id: swipedId, user2Id: userId }
          ]
        }
      });

      if (match) {
        await prisma.message.deleteMany({
          where: { matchId: match.id }
        });
        await prisma.match.delete({
          where: { id: match.id }
        });
      }
    }

    await prisma.swipe.delete({
      where: { id: swipeId }
    });

    const rewoundUser = await prisma.user.findUnique({
      where: { id: swipedId }
    });

    if (rewoundUser) {
      return res.json({ success: true, user: formatUserCard(rewoundUser) });
    }

    res.json({ success: true, user: null });
  } catch (error) {
    console.error('Rewind error:', error);
    res.status(500).json({ error: 'Erro interno ao desfazer swipe' });
  }
});

export default router;
