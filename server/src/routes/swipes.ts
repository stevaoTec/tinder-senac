import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const swipeSchema = z.object({
  targetUserId: z.number(),
  direction: z.enum(['like', 'dislike', 'superlike'])
});

function hasUsedRewindToday(lastRewindAt: Date | null | undefined): boolean {
  if (!lastRewindAt) return false;
  const tz = 'America/Sao_Paulo';
  const lastDay = new Date(lastRewindAt).toLocaleDateString('pt-BR', { timeZone: tz });
  const today = new Date().toLocaleDateString('pt-BR', { timeZone: tz });
  return lastDay === today;
}

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

// POST /api/swipes - Swipe on a user
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { targetUserId, direction } = swipeSchema.parse(req.body);
    const userId = req.userId as number;

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Você não pode curtir a si mesmo' });
    }

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

    let matchResult = null;
    if (direction === 'like' || direction === 'superlike') {
      const [mutualLike, currentSwiper] = await Promise.all([
        prisma.swipe.findFirst({
          where: {
            swiperId: targetUserId,
            swipedId: userId,
            direction: { in: ['like', 'superlike'] }
          }
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { email: true }
        })
      ]);

      const isAdminSwiper = currentSwiper?.email?.toLowerCase() === 'steven35silva@gmail.com';

      if (mutualLike || isAdminSwiper) {
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
              isSuper: direction === 'superlike' || mutualLike?.direction === 'superlike'
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

// GET /api/swipes/disliked - List disliked users + daily rewind availability (1x per day)
router.get('/disliked', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;

    const [currentUser, dislikedSwipes] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { lastRewindAt: true }
      }),
      prisma.swipe.findMany({
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
      })
    ]);

    const usedToday = hasUsedRewindToday(currentUser?.lastRewindAt);
    const users = dislikedSwipes
      .filter(s => s.swiped && !s.swiped.email.endsWith('@demo.com') && s.swiped.email?.toLowerCase() !== 'steven35silva@gmail.com')
      .map(s => formatUserCard(s.swiped));

    res.json({
      users,
      canRewindToday: !usedToday,
      rewindsRemainingToday: usedToday ? 0 : 1
    });
  } catch (error) {
    console.error('Get disliked users error:', error);
    res.status(500).json({ error: 'Erro ao buscar perfis recusados' });
  }
});

// POST /api/swipes/restore/:targetUserId - Restore 1 disliked user back to discover queue (max 1x per day)
router.post('/restore/:targetUserId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;
    const targetUserId = parseInt(req.params.targetUserId);

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastRewindAt: true }
    });

    if (hasUsedRewindToday(currentUser?.lastRewindAt)) {
      return res.status(429).json({
        error: 'Você já usou sua 1 chance de voltar hoje! Tente novamente amanhã.'
      });
    }

    await prisma.$transaction([
      prisma.swipe.deleteMany({
        where: {
          swiperId: userId,
          swipedId: targetUserId
        }
      }),
      prisma.user.update({
        where: { id: userId },
        data: { lastRewindAt: new Date() }
      })
    ]);

    const restoredUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    res.json({
      success: true,
      user: restoredUser ? formatUserCard(restoredUser) : null,
      canRewindToday: false,
      rewindsRemainingToday: 0
    });
  } catch (error) {
    console.error('Restore swipe error:', error);
    res.status(500).json({ error: 'Erro ao restaurar perfil' });
  }
});

// DELETE /api/swipes/rewind - Undo the last dislike (max 1x per day)
router.delete('/rewind', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as number;

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastRewindAt: true }
    });

    if (hasUsedRewindToday(currentUser?.lastRewindAt)) {
      return res.status(429).json({
        error: 'Você já usou sua 1 chance de voltar hoje! Tente novamente amanhã.'
      });
    }

    const lastDislike = await prisma.swipe.findFirst({
      where: { swiperId: userId, direction: 'dislike' },
      orderBy: { createdAt: 'desc' }
    });

    if (!lastDislike) {
      return res.status(400).json({ error: 'Você ainda não recusou ninguém para voltar' });
    }

    const { id: swipeId, swipedId } = lastDislike;

    await prisma.$transaction([
      prisma.swipe.delete({
        where: { id: swipeId }
      }),
      prisma.user.update({
        where: { id: userId },
        data: { lastRewindAt: new Date() }
      })
    ]);

    const rewoundUser = await prisma.user.findUnique({
      where: { id: swipedId }
    });

    if (rewoundUser) {
      return res.json({
        success: true,
        user: formatUserCard(rewoundUser),
        canRewindToday: false,
        rewindsRemainingToday: 0
      });
    }

    res.json({ success: true, user: null, canRewindToday: false, rewindsRemainingToday: 0 });
  } catch (error) {
    console.error('Rewind error:', error);
    res.status(500).json({ error: 'Erro interno ao desfazer swipe' });
  }
});

export default router;
