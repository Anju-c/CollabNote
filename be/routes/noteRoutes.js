const express = require('express');
const Delta = require('quill-delta');

module.exports = (prisma, io, authenticateToken) => {
  const router = express.Router();

  router.post('/new', async (req, res) => {
    try {
      const newNote = await prisma.note.create({
        data: {
          content: JSON.stringify(new Delta()),
        },
      });
      res.status(201).json({ noteId: newNote.id });
    } catch (error) {
      console.error('Error creating new note:', error);
      res.status(500).json({ message: 'Internal server error while creating note.' });
    }
  });

  return router;
};
