import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Track user presence
  const presence: Record<string, { userId: string, name: string, handle: string, avatar: string, location: string }> = {};

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join:presence', (userData) => {
      presence[socket.id] = userData;
      io.emit('presence:list', Object.values(presence));
    });

    socket.on('join:room', (roomId) => {
      socket.join(roomId);
      const room = io.sockets.adapter.rooms.get(roomId);
      const userCount = room ? room.size : 0;
      io.to(roomId).emit('room:sync', { roomId, userCount });
    });

    socket.on('leave:room', (roomId) => {
      socket.leave(roomId);
      const room = io.sockets.adapter.rooms.get(roomId);
      const userCount = room ? room.size : 0;
      io.to(roomId).emit('room:sync', { roomId, userCount });
    });

    socket.on('document:update', (data) => {
      // data: { roomId, content, userId }
      socket.to(data.roomId).emit('document:sync', data);
    });

    socket.on('notification:send', (data) => {
      // data: { targetUserId, notification }
      io.emit('notification:receive', data);
    });

    socket.on('disconnect', () => {
      delete presence[socket.id];
      io.emit('presence:list', Object.values(presence));
      console.log('User disconnected:', socket.id);
    });
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
