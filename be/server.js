const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Delta = require('quill-delta');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const noteRoutes = require('./routes/noteRoutes');
const authRoutes = require('./routes/authRoutes');
const commentRoutes = require('./routes/commentRoutes');
const { authenticateToken, getUserIdFromToken } = require('./middleware/authMiddleware');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

app.use(cors({
  origin: "http://localhost:5173"
}));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const noteUsers = {};

io.use((socket, next) => {
  const token = socket.handshake.query.token;
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.warn('Socket authentication failed:', err.message);
        return next(new Error('Authentication error'));
      }
      socket.user = user;
      next();
    });
  } else {
    console.log('Unauthenticated socket connection.');
    next();
  }
});

io.on('connection', async (socket) => {
  const noteId = socket.handshake.query.noteId;
  console.log(`User connected: ${socket.id} to note: ${noteId}`);
  if (socket.user) {
    console.log(`Authenticated user ${socket.user.username} connected.`);
  }

  socket.join(noteId);

  let note;
  try {
    note = await prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      note = await prisma.note.create({
        data: {
          id: noteId,
          content: JSON.stringify(new Delta()),
        },
      });
      console.log(`Created new note in DB: ${noteId}`);
    } else {
      console.log(`Found existing note in DB: ${noteId}`);
    }
  } catch (error) {
    console.error(`Error accessing note ${noteId} in DB:`, error);
    socket.disconnect(true);
    return;
  }

  if (!noteUsers[noteId]) {
    noteUsers[noteId] = new Set();
  }
  noteUsers[noteId].add(socket.id);

  // Emit initial content using a distinct event name
  socket.emit('initial-note-content', JSON.parse(note.content));
  io.to(noteId).emit('users-online', noteUsers[noteId].size);

  socket.on('send-delta', async (data) => {
    const { noteId: receivedNoteId, delta } = data;

    if (receivedNoteId !== noteId) {
      console.warn(`Mismatch noteId: ${receivedNoteId} vs ${noteId}`);
      return;
    }

    try {
      const currentNote = await prisma.note.findUnique({
        where: { id: noteId },
      });

      if (currentNote) {
        const currentDelta = new Delta(JSON.parse(currentNote.content));
        const composedDelta = currentDelta.compose(new Delta(delta));

        await prisma.note.update({
          where: { id: noteId },
          data: { content: JSON.stringify(composedDelta) },
        });

        socket.broadcast.to(noteId).emit('delta-from-server', delta);
        console.log(`Delta received for note ${noteId}, applied, and broadcasted.`);
      } else {
        console.warn(`Note ${noteId} not found in DB during delta update.`);
      }
    } catch (error) {
      console.error(`Error updating note ${noteId} in DB:`, error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id} from note: ${noteId}`);
    if (noteUsers[noteId]) {
      noteUsers[noteId].delete(socket.id);
      if (noteUsers[noteId].size === 0) {
        console.log(`No users left in note ${noteId}.`);
      } else {
        io.to(noteId).emit('users-online', noteUsers[noteId].size);
      }
    }
  });
});

app.use('/api/auth', authRoutes(prisma, JWT_SECRET));
app.use('/api/notes', noteRoutes(prisma, io, authenticateToken));
app.use('/api/notes', commentRoutes(prisma, io, authenticateToken));

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit();
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
