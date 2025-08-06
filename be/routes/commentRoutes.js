const express = require('express');

module.exports = (prisma, io, authenticateToken) => {
  const router = express.Router();

  router.get('/:noteId/comments', async (req, res) => {
    const { noteId } = req.params;
    try {
      const comments = await prisma.comment.findMany({
        where: { noteId: noteId },
        include: {
          author: {
            select: { username: true }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      res.status(200).json(comments);
    } catch (error) {
      console.error(`Error fetching comments for note ${noteId}:`, error);
      res.status(500).json({ message: 'Internal server error fetching comments.' });
    }
  });

  router.post('/:noteId/comments', authenticateToken, async (req, res) => {
    const { noteId } = req.params;
    const { text } = req.body;
    const authorId = req.user.userId;

    if (!text || !authorId) {
      return res.status(400).json({ message: 'Comment text and user are required.' });
    }

    try {
      const newComment = await prisma.comment.create({
        data: {
          text: text,
          noteId: noteId,
          authorId: authorId,
        },
        include: {
          author: {
            select: { username: true }
          }
        }
      });

      io.to(noteId).emit('new-comment-from-server', newComment);

      res.status(201).json(newComment);
    } catch (error) {
      console.error(`Error adding comment to note ${noteId}:`, error);
      res.status(500).json({ message: 'Internal server error adding comment.' });
    }
  });

  return router;
};
