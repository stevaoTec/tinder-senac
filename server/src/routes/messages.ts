import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../database/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const messageSchema = z.object({
  content: z.string().min(1, 'Conteúdo da mensagem é obrigatório')
});

// GET /api/messages/:matchId - Get messages for a match
router.get('/:matchId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const matchId = parseInt(req.params.matchId);
    const userId = req.userId as number;

    // Verify user is part of this match
    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [{ user1Id: userId }, { user2Id: userId }]
      }
    });

    if (!match) {
      return res.status(403).json({ error: 'Não autorizado a ver estas mensagens' });
    }

    const messages = await prisma.message.findMany({
      where: { matchId },
      include: {
        sender: {
          select: { name: true, profilePhoto: true, photos: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const mappedMessages = messages.map(m => {
      const senderPhotos: string[] = JSON.parse(m.sender.photos || '[]');
      const rawPhoto = m.sender.profilePhoto || senderPhotos[0] || '';
      return {
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        createdAt: m.createdAt,
        read: m.read,
        senderName: m.sender.name,
        senderPhoto: rawPhoto ? rawPhoto.replace(/=s\d+(-c)?$/, '=s800-c') : ''
      };
    });

    // Mark messages from the other user as read
    await prisma.message.updateMany({
      where: {
        matchId,
        senderId: { not: userId }
      },
      data: { read: 1 }
    });

    res.json(mappedMessages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Erro interno ao buscar mensagens' });
  }
});

// POST /api/messages/:matchId - Send a message
router.post('/:matchId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = messageSchema.parse(req.body);
    const matchId = parseInt(req.params.matchId);
    const userId = req.userId as number;

    // Verify user is part of this match
    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [{ user1Id: userId }, { user2Id: userId }]
      }
    });

    if (!match) {
      return res.status(403).json({ error: 'Não autorizado a enviar mensagens neste match' });
    }

    const newMessage = await prisma.message.create({
      data: {
        matchId,
        senderId: userId,
        content: content.trim()
      },
      include: {
        sender: {
          select: { name: true, profilePhoto: true, photos: true }
        }
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: { vibeScore: { increment: 2 } }
    });

    const senderPhotos: string[] = JSON.parse(newMessage.sender.photos || '[]');
    const rawPhoto = newMessage.sender.profilePhoto || senderPhotos[0] || '';

    const mappedMessage = {
      id: newMessage.id,
      content: newMessage.content,
      senderId: newMessage.senderId,
      createdAt: newMessage.createdAt,
      read: newMessage.read,
      senderName: newMessage.sender.name,
      senderPhoto: rawPhoto ? rawPhoto.replace(/=s\d+(-c)?$/, '=s800-c') : ''
    };

    const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;

    res.json({ message: mappedMessage, otherUserId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: (error as any).errors[0].message });
    }
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Erro interno ao enviar mensagem' });
  }
});

export default router;
