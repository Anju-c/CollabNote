const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Delta = require('quill-delta');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const noteRoutes = require('./routes/noteRoutes');
const authRoutes = require('./routes/authRoutes');
const commentRoutes = require('./routes/commentRoutes');
const { authenticateToken } = require('./middleware/authMiddleware');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret_key_change_this_in_production';
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const noteUsers = {};

// Helper function to safely parse Delta content
const parseDeltaContent = (content) => {
  try {
    if (!content || content === '""' || content === 'null') {
      console.log('📝 Creating empty Delta for null/empty content');
      return new Delta();
    }
    
    if (typeof content === 'string') {
      const parsed = JSON.parse(content);
      if (!parsed || (!parsed.ops && !Array.isArray(parsed))) {
        return new Delta();
      }
      return new Delta(parsed.ops || parsed);
    }
    
    if (content instanceof Delta) {
      return content;
    }
    
    if (typeof content === 'object' && content.ops) {
      return new Delta(content.ops);
    }
    
    return new Delta();
  } catch (error) {
    console.error('❌ Error parsing Delta content:', error);
    console.error('Content was:', content);
    return new Delta();
  }
};

// Helper function to safely serialize Delta content
const serializeDeltaContent = (delta) => {
  try {
    if (!delta) {
      return JSON.stringify({ ops: [] });
    }
    
    if (delta instanceof Delta) {
      return JSON.stringify(delta);
    }
    
    if (typeof delta === 'object' && delta.ops) {
      return JSON.stringify(delta);
    }
    
    return JSON.stringify(new Delta(delta));
  } catch (error) {
    console.error('❌ Error serializing Delta content:', error);
    return JSON.stringify({ ops: [] });
  }
};

// Socket authentication
io.use((socket, next) => {
  const token = socket.handshake.query.token;
  
  if (token && token !== 'null' && token !== 'undefined') {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.warn(`⚠️  Socket auth failed: ${err.message}`);
        socket.user = null;
      } else {
        socket.user = user;
        console.log(`✅ Socket authenticated: ${user.username}`);
      }
      next();
    });
  } else {
    socket.user = null;
    next();
  }
});

io.on('connection', async (socket) => {
  const noteId = socket.handshake.query.noteId;
  
  console.log(`\n🔌 NEW CONNECTION`);
  console.log(`Socket: ${socket.id}`);
  console.log(`Note: ${noteId}`);
  console.log(`User: ${socket.user?.username || 'Anonymous'}`);

  if (!noteId) {
    console.error('❌ No noteId provided');
    socket.disconnect(true);
    return;
  }

  socket.join(noteId);

  // Get or create note
  let note;
  try {
    note = await prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      const emptyDelta = new Delta();
      note = await prisma.note.create({
        data: {
          id: noteId,
          content: serializeDeltaContent(emptyDelta),
        },
      });
      console.log(`📝 Created new note: ${noteId}`);
    } else {
      console.log(`📖 Found existing note: ${noteId}`);
    }
  } catch (error) {
    console.error(`❌ Database error for note ${noteId}:`, error);
    socket.disconnect(true);
    return;
  }

  // Track users
  if (!noteUsers[noteId]) {
    noteUsers[noteId] = new Set();
  }
  noteUsers[noteId].add(socket.id);

  // Send initial content
  const initialContent = parseDeltaContent(note.content);
  console.log(`📤 Sending initial content:`);
  console.log(`   Ops count: ${initialContent.ops.length}`);
  console.log(`   First few ops:`, initialContent.ops.slice(0, 3));
  
  socket.emit('initial-note-content', initialContent);
  
  // Send user count
  const userCount = noteUsers[noteId].size;
  io.to(noteId).emit('users-online', userCount);
  console.log(`👥 Users online: ${userCount}`);

  socket.on('send-delta', async (data) => {
    const { noteId: receivedNoteId, delta } = data;

    if (receivedNoteId !== noteId) {
      console.warn(`⚠️  Note ID mismatch: received ${receivedNoteId}, expected ${noteId}`);
      return;
    }

    console.log(`\n📨 RECEIVED DELTA for ${noteId}:`);
    console.log(`   From socket: ${socket.id}`);
    console.log(`   User: ${socket.user?.username || 'Anonymous'}`);
    console.log(`   Delta ops:`, JSON.stringify(delta.ops || delta, null, 2));

    try {
      // Get current content from database (most up-to-date)
      const currentNote = await prisma.note.findUnique({
        where: { id: noteId },
      });

      if (!currentNote) {
        console.error(`❌ Note ${noteId} not found during delta update`);
        socket.emit('delta-error', { error: 'Note not found', noteId });
        return;
      }

      // Parse current content and incoming delta
      const currentDelta = parseDeltaContent(currentNote.content);
      const incomingDelta = new Delta(delta);
      
      console.log(`📋 Current content ops: ${currentDelta.ops.length}`);
      console.log(`📥 Incoming delta ops: ${incomingDelta.ops.length}`);
      
      // Compose the current content with the incoming delta
      const composedDelta = currentDelta.compose(incomingDelta);
      
      console.log(`🔄 Composed result ops: ${composedDelta.ops.length}`);
      console.log(`   Preview of final content:`, 
        composedDelta.ops.slice(0, 5).map(op => 
          typeof op.insert === 'string' ? op.insert.substring(0, 50) : op
        )
      );

      // Update database with the new composed content
      const updatedNote = await prisma.note.update({
        where: { id: noteId },
        data: { 
          content: serializeDeltaContent(composedDelta),
          updatedAt: new Date()
        },
      });

      console.log(`💾 Database updated successfully at ${updatedNote.updatedAt}`);

      // Broadcast the ORIGINAL DELTA (not composed result) to other clients
      // This is crucial - other clients will compose it with their own state
      socket.broadcast.to(noteId).emit('delta-from-server', incomingDelta);
      
      console.log(`📡 Broadcasted original delta to ${noteUsers[noteId].size - 1} other clients`);
      
      // Send acknowledgment
      socket.emit('delta-acknowledged', { 
        noteId, 
        success: true,
        timestamp: Date.now(),
        finalOpsCount: composedDelta.ops.length
      });

    } catch (error) {
      console.error(`❌ Error processing delta for ${noteId}:`, error);
      socket.emit('delta-error', { 
        error: error.message, 
        noteId,
        timestamp: Date.now()
      });
    }
  });

  // Handle sync requests for conflict resolution
  socket.on('request-sync', async () => {
    console.log(`🔄 Sync requested for ${noteId} by ${socket.id}`);
    try {
      const currentNote = await prisma.note.findUnique({
        where: { id: noteId },
      });
      
      if (currentNote) {
        const currentContent = parseDeltaContent(currentNote.content);
        socket.emit('sync-content', currentContent);
        console.log(`✅ Sent sync content (${currentContent.ops.length} ops)`);
      }
    } catch (error) {
      console.error(`❌ Error syncing ${noteId}:`, error);
      socket.emit('sync-error', { error: error.message });
    }
  });

  // Handle forced save (useful for debugging)
  socket.on('force-save', async (content) => {
    if (socket.user) { // Only authenticated users can force save
      try {
        const delta = new Delta(content);
        await prisma.note.update({
          where: { id: noteId },
          data: { 
            content: serializeDeltaContent(delta),
            updatedAt: new Date()
          },
        });
        console.log(`🔧 Force save completed for ${noteId} by ${socket.user.username}`);
        socket.emit('force-save-complete', { success: true });
      } catch (error) {
        console.error(`❌ Force save error:`, error);
        socket.emit('force-save-error', { error: error.message });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`\n👋 DISCONNECTION`);
    console.log(`Socket: ${socket.id}`);
    console.log(`Note: ${noteId}`);
    console.log(`User: ${socket.user?.username || 'Anonymous'}`);
    
    if (noteUsers[noteId]) {
      noteUsers[noteId].delete(socket.id);
      const remainingUsers = noteUsers[noteId].size;
      
      if (remainingUsers === 0) {
        console.log(`🏠 Note ${noteId} is now empty, cleaning up`);
        delete noteUsers[noteId];
      } else {
        io.to(noteId).emit('users-online', remainingUsers);
        console.log(`👥 ${remainingUsers} users remaining in note ${noteId}`);
      }
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes(prisma, JWT_SECRET));
app.use('/api/notes', noteRoutes(prisma, io, authenticateToken));
app.use('/api/notes', commentRoutes(prisma, io, authenticateToken));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.1',
    activeNotes: Object.keys(noteUsers).length,
    totalConnections: Object.values(noteUsers).reduce((total, set) => total + set.size, 0)
  });
});

// Test database
app.get('/api/test-db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const noteCount = await prisma.note.count();
    res.json({ 
      database: 'Connected', 
      noteCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ database: 'Error', error: error.message });
  }
});

// Debug endpoint to check specific note content
app.get('/api/debug/note/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const note = await prisma.note.findUnique({
      where: { id: noteId },
    });
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    const parsedContent = parseDeltaContent(note.content);
    
    res.json({
      id: note.id,
      rawContent: note.content,
      parsedContent: parsedContent,
      opsCount: parsedContent.ops.length,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      activeUsers: noteUsers[noteId] ? noteUsers[noteId].size : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down server...');
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
    process.exit(0);
  } catch (error) {
    console.error('❌ Shutdown error:', error);
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
server.listen(PORT, () => {
  console.log(`\n🚀 CollabNote Server Started`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`🔗 WebSocket ready for collaborative editing`);
  console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Using fallback'}`);
  console.log(`🔐 JWT: ${process.env.JWT_SECRET ? 'Configured' : 'Using fallback'}`);
  console.log(`🛠️  Debug: http://localhost:${PORT}/api/debug/note/YOUR_NOTE_ID\n`);
});