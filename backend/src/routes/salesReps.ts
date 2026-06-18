import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const reps = await prisma.salesRep.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    res.json(reps);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const rep = await prisma.salesRep.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.status(201).json(rep);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'E-Mail bereits vergeben.' });
    }
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const data: Record<string, unknown> = { name, email, role };
    if (password) data.passwordHash = await bcrypt.hash(password, 10);
    const rep = await prisma.salesRep.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.json(rep);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    if (req.params.id === req.session.userId) {
      return res.status(400).json({ message: 'Eigenes Konto kann nicht gelöscht werden.' });
    }
    await prisma.salesRep.delete({ where: { id: req.params.id } });
    res.json({ message: 'Benutzer gelöscht.' });
  } catch (error: any) {
    if (error.code === 'P2003' || error.code === 'P2014') {
      return res.status(409).json({ message: 'Benutzer kann nicht gelöscht werden – er hat noch Aufträge oder Aktivitäten.' });
    }
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

export default router;
