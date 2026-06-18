import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const accessories = await prisma.accessory.findMany({ orderBy: { name: 'asc' } });
    res.json(accessories);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, description, hasSerialNumber } = req.body;
    const accessory = await prisma.accessory.create({
      data: { name, description, hasSerialNumber: !!hasSerialNumber },
    });
    res.status(201).json(accessory);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, description, hasSerialNumber } = req.body;
    const accessory = await prisma.accessory.update({
      where: { id: req.params.id },
      data: { name, description, hasSerialNumber: !!hasSerialNumber },
    });
    res.json(accessory);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.accessory.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht.' });
  } catch (error: any) {
    if (error.code === 'P2003' || error.code === 'P2014') {
      return res.status(409).json({ message: 'Zubehör kann nicht gelöscht werden – es ist noch in Aufträgen verwendet.' });
    }
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

export default router;
