import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import swipeRoutes from './routes/swipes';
import matchRoutes from './routes/matches';
import messageRoutes from './routes/messages';
import { setupSocket } from './socket/chat';
import { ensureSeedUsers } from './database/seed';

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (
      !origin ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.onrender.com') ||
      (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)
    ) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
};

const io = new Server(server, {
  cors: corsOptions
});

// Ensure required directories exist
const dirs = ['data', 'uploads', 'uploads/profiles', 'uploads/covers'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));



// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/swipes', swipeRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/messages', messageRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend if running in production mode / locally
const frontendPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
        // Nunca fazer cache do HTML e do Service Worker (evita tela branca)
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else {
        // Fazer cache longo das imagens, js e css (deixa o site super rápido)
        res.setHeader('Cache-Control', 'public, max-age=31536000');
      }
    }
  }));
  
  app.get('*', (req, res) => {
    // Only catch non-api routes
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}

// Setup Socket.io
setupSocket(io);

// Start server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('=========================================');
  console.log(`  MatchVibe Server rodando na porta ${PORT}`);
  console.log('  http://localhost:' + PORT);
  console.log('=========================================');
  console.log('');
  ensureSeedUsers();
});
