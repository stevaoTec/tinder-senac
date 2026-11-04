import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface SocketContextType {
  socket: Socket | null;
  onlineUsers: Set<number>;
  unreadNotifications: number;
  clearNotifications: () => void;
}

const SocketContext = createContext<SocketContextType>({ 
  socket: null, 
  onlineUsers: new Set(),
  unreadNotifications: 0,
  clearNotifications: () => {}
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { token } = useAuth();

  const clearNotifications = () => setUnreadNotifications(0);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
      : window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : window.location.origin;

    const newSocket = io(socketUrl, {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Socket conectado');
    });

    newSocket.on('online_users_list', (ids: number[]) => {
      setOnlineUsers(new Set(ids));
    });

    newSocket.on('user_online', ({ userId }: { userId: number }) => {
      setOnlineUsers(prev => new Set(prev).add(userId));
    });

    newSocket.on('user_offline', ({ userId }: { userId: number }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    newSocket.on('message_notification', (data: any) => {
      // Don't show toast if currently in this chat room
      if (!window.location.pathname.includes(`/chat/${data.matchId}`)) {
        setUnreadNotifications(prev => prev + 1);
        toast.success(`Nova mensagem de ${data.message.senderName}`, {
          duration: 4000,
        });
      }
    });

    newSocket.on('like_notification', () => {
      setUnreadNotifications(prev => prev + 1);
      toast('Alguem curtiu seu perfil!', {
        icon: '👀',
        duration: 4000,
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, unreadNotifications, clearNotifications }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
