import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth';

const userSockets = new Map<number, Set<string>>();
const recentlyActiveUsers = new Map<number, number>(); // userId -> timestamp

export const markUserActive = (userId: number) => {
  recentlyActiveUsers.set(userId, Date.now());
};

export const getOnlineUserIds = (): number[] => {
  const now = Date.now();
  const ids = new Set<number>(userSockets.keys());
  for (const [userId, timestamp] of recentlyActiveUsers.entries()) {
    // Grace period of 45s after login/discover request while socket finishes connecting
    if (now - timestamp < 45000) {
      ids.add(userId);
    } else {
      recentlyActiveUsers.delete(userId);
    }
  }
  return Array.from(ids);
};

export const getOnlineUsersCount = () => getOnlineUserIds().length;

const getFirstSocketId = (userId: number): string | undefined => {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return undefined;
  return Array.from(sockets)[0];
};

export function setupSocket(io: Server): void {
  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Token de autenticacao nao fornecido'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      (socket as any).userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Token invalido'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId as number;
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    recentlyActiveUsers.set(userId, Date.now());

    console.log(`User ${userId} connected (socket: ${socket.id})`);

    // Send full list of currently online users to this client
    socket.emit('online_users_list', getOnlineUserIds());

    // Broadcast that user is online
    io.emit('user_online', { userId });

    // Join a match chat room
    socket.on('join_match', (matchId: number) => {
      socket.join(`match_${matchId}`);
    });

    // Leave a match chat room
    socket.on('leave_match', (matchId: number) => {
      socket.leave(`match_${matchId}`);
    });

    // Real-time message sending
    socket.on('send_message', (data: { matchId: number; message: any; otherUserId: number }) => {
      // Broadcast to the match room (excluding sender)
      socket.to(`match_${data.matchId}`).emit('new_message', data.message);

      // Send notification to the specific other user
      const otherSockets = userSockets.get(data.otherUserId);
      if (otherSockets) {
        otherSockets.forEach(sid => {
          io.to(sid).emit('message_notification', {
            matchId: data.matchId,
            message: data.message
          });
        });
      }
    });

    // Typing indicators
    socket.on('typing', (data: { matchId: number }) => {
      socket.to(`match_${data.matchId}`).emit('user_typing', { userId });
    });

    socket.on('stop_typing', (data: { matchId: number }) => {
      socket.to(`match_${data.matchId}`).emit('user_stop_typing', { userId });
    });

    // Real-time read receipts
    socket.on('mark_read', (data: { matchId: number; otherUserId: number }) => {
      const targetSocketId = getFirstSocketId(data.otherUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('messages_read', { matchId: data.matchId });
      }
    });

    // Match notification
    socket.on('new_match', (data: { targetUserId: number; match: any }) => {
      const otherSockets = userSockets.get(data.targetUserId);
      if (otherSockets) {
        otherSockets.forEach(sid => {
          io.to(sid).emit('match_notification', data.match);
        });
      }
    });

    // Generic Like notification
    socket.on('send_like', (data: { targetUserId: number }) => {
      const otherSockets = userSockets.get(data.targetUserId);
      if (otherSockets) {
        otherSockets.forEach(sid => {
          io.to(sid).emit('like_notification');
        });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          recentlyActiveUsers.delete(userId);
          io.emit('user_offline', { userId });
          console.log(`User ${userId} disconnected`);
        }
      }
    });
  });
}
