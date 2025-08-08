const express = require('express');
const Delta = require('quill-delta');

module.exports = (prisma, io, authenticateToken) => {
  const router = express.Router();

  // Helper function to safely serialize Delta content
  const serializeDeltaContent = (delta) => {
    try {
      if (delta instanceof Delta) {
        return JSON.stringify(delta);
      }
      if (typeof delta === 'object' && delta.ops) {
        return JSON.stringify(delta);
      }
      return JSON.stringify(new Delta(delta));
    } catch (error) {
      console.error('Error serializing Delta content:', error, delta);
      return JSON.stringify(new Delta());
    }
  };

  // Helper function to safely parse Delta content
  const parseDeltaContent = (content) => {
    try {
      if (!content || content === '""' || content === 'null') {
        return new Delta();
      }
      
      if (typeof content === 'string') {
        const parsed = JSON.parse(content);
        if (!parsed || !parsed.ops) {
          return new Delta();
        }
        return new Delta(parsed.ops);
      }
      
      if (content instanceof Delta) {
        return content;
      }
      
      if (typeof content === 'object' && content.ops) {
        return new Delta(content.ops);
      }
      
      return new Delta();
    } catch (error) {
      console.error('Error parsing Delta content:', error);
      return new Delta();
    }
  };

  // IMPORTANT: Put more specific routes BEFORE generic ones
  // Route to get recently worked on notes - MOVED TO TOP
  router.get('/recent', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
      // Find notes commented on by the user, sorted by last update time
      const notes = await prisma.note.findMany({
        where: {
          comments: {
            some: {
              authorId: userId,
            },
          },
        },
        include: {
          comments: {
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
            include: {
              author: {
                select: {
                  username: true,
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 10, // Limit to 10 recent notes
      });

      // Transform the notes to include parsed content
      const transformedNotes = notes.map(note => {
        const parsedContent = parseDeltaContent(note.content);
        return {
          ...note,
          content: parsedContent,
        };
      });

      res.status(200).json(transformedNotes);
    } catch (error) {
      console.error('Error fetching recent notes:', error);
      res.status(500).json({ message: 'Internal server error fetching recent notes.' });
    }
  });

  // Route to create a new note
  router.post('/new', async (req, res) => {
    try {
      const emptyDelta = new Delta();
      const newNote = await prisma.note.create({
        data: {
          content: serializeDeltaContent(emptyDelta),
        },
      });
      
      console.log(`Created new note: ${newNote.id} with empty Delta content`);
      res.status(201).json({ noteId: newNote.id });
    } catch (error) {
      console.error('Error creating new note:', error);
      res.status(500).json({ message: 'Internal server error while creating note.' });
    }
  });

  // Route to get a specific note by ID
  router.get('/:noteId', async (req, res) => {
    const { noteId } = req.params;
    
    // Skip if this is the 'recent' route
    if (noteId === 'recent') {
      return next();
    }
    
    try {
      let note = await prisma.note.findUnique({
        where: { id: noteId },
      });

      // If note doesn't exist, create it
      if (!note) {
        const emptyDelta = new Delta();
        note = await prisma.note.create({
          data: {
            id: noteId,
            content: serializeDeltaContent(emptyDelta),
          },
        });
        console.log(`Created new note: ${noteId} via GET request`);
      }

      // Parse and return the note content
      const parsedContent = parseDeltaContent(note.content);

      res.status(200).json({
        id: note.id,
        content: parsedContent,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      });
    } catch (error) {
      console.error(`Error fetching note ${noteId}:`, error);
      res.status(500).json({ message: 'Internal server error while fetching note.' });
    }
  });

  // Route to update a note's content (REST fallback)
  router.put('/:noteId', async (req, res) => {
    const { noteId } = req.params;
    const { content } = req.body;

    try {
      // Validate and serialize the content
      const deltaContent = new Delta(content);
      const serializedContent = serializeDeltaContent(deltaContent);

      // Get current note or create if doesn't exist
      let note = await prisma.note.findUnique({
        where: { id: noteId },
      });

      if (!note) {
        note = await prisma.note.create({
          data: {
            id: noteId,
            content: serializedContent,
          },
        });
        console.log(`Created new note ${noteId} via PUT request`);
      } else {
        note = await prisma.note.update({
          where: { id: noteId },
          data: { 
            content: serializedContent,
            updatedAt: new Date()
          },
        });
        console.log(`Updated note ${noteId} via REST API`);
      }

      res.status(200).json({
        id: note.id,
        content: JSON.parse(note.content),
        updatedAt: note.updatedAt,
      });
    } catch (error) {
      console.error(`Error updating note ${noteId}:`, error);
      res.status(500).json({ message: 'Internal server error while updating note.' });
    }
  });

  // Route to delete a note
  router.delete('/:noteId', async (req, res) => {
    const { noteId } = req.params;

    try {
      // Delete all comments first (due to foreign key constraints)
      await prisma.comment.deleteMany({
        where: { noteId },
      });

      // Delete the note
      await prisma.note.delete({
        where: { id: noteId },
      });

      console.log(`Deleted note ${noteId} and associated comments`);
      res.status(200).json({ message: 'Note deleted successfully.' });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Note not found.' });
      }
      console.error(`Error deleting note ${noteId}:`, error);
      res.status(500).json({ message: 'Internal server error while deleting note.' });
    }
  });

  return router;
};