const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = (prisma, JWT_SECRET) => {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
      const existingUser = await prisma.user.findUnique({
        where: { username: username },
      });

      if (existingUser) {
        return res.status(409).json({ message: 'Username already taken.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: {
          username: username,
          password: hashedPassword,
        },
      });

      const token = jwt.sign({ userId: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '1h' });

      res.status(201).json({ message: 'User registered successfully!', token: token, user: { id: newUser.id, username: newUser.username } });
    } catch (error) {
      console.error('Error during user registration:', error);
      res.status(500).json({ message: 'Internal server error during registration.' });
    }
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { username: username },
      });

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

      res.status(200).json({ message: 'Login successful!', token: token, user: { id: user.id, username: user.username } });
    } catch (error) {
      console.error('Error during user login:', error);
      res.status(500).json({ message: 'Internal server error during login.' });
    }
  });

  return router;
};
