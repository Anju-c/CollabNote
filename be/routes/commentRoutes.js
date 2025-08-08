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
            select: { id: true, username: true }
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

    console.log(`💬 Adding comment to note ${noteId}:`);
    console.log(`   Author ID: ${authorId}`);
    console.log(`   Username from token: ${req.user.username}`);
    console.log(`   Comment text: ${text}`);

    if (!text || !authorId) {
      return res.status(400).json({ message: 'Comment text and user are required.' });
    }

    try {
      // Verify the user exists in database
      const user = await prisma.user.findUnique({
        where: { id: authorId },
        select: { id: true, username: true }
      });

      if (!user) {
        console.error(`❌ User not found in database: ${authorId}`);
        return res.status(401).json({ message: 'User not found.' });
      }

      console.log(`✅ Verified user exists: ${user.username} (${user.id})`);

      const newComment = await prisma.comment.create({
        data: {
          text: text,
          noteId: noteId,
          authorId: authorId,
        },
        include: {
          author: {
            select: { id: true, username: true }
          }
        }
      });

      console.log(`✅ Created comment:`, {
        id: newComment.id,
        authorId: newComment.authorId,
        authorUsername: newComment.author.username,
        text: newComment.text.substring(0, 50) + '...'
      });

      // Broadcast to all connected clients in this note room
      io.to(noteId).emit('new-comment-from-server', newComment);
      console.log(`📡 Broadcasted comment to note room ${noteId}`);

      res.status(201).json(newComment);
    } catch (error) {
      console.error(`❌ Error adding comment to note ${noteId}:`, error);
      res.status(500).json({ message: 'Internal server error adding comment.' });
    }
  });

  return router;
};