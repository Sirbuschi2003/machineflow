import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'E-Mail und Passwort erforderlich.' });
    }

    const user = await prisma.salesRep.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Ungültige Anmeldedaten.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Ungültige Anmeldedaten.' });
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userName = user.name;

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Erfolgreich abgemeldet.' });
  });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.salesRep.findUnique({
      where: { id: req.session.userId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden.' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

export default router;
