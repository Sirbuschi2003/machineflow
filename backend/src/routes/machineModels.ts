import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const models = await prisma.machineModel.findMany({ orderBy: { modelName: 'asc' } });
    res.json(models);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.post('/', requireRole('ADMIN', 'MANAGEMENT'), async (req, res) => {
  try {
    const { modelName, description } = req.body;
    const model = await prisma.machineModel.create({ data: { modelName, description } });
    res.status(201).json(model);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.put('/:id', requireRole('ADMIN', 'MANAGEMENT'), async (req, res) => {
  try {
    const { modelName, description } = req.body;
    const model = await prisma.machineModel.update({
      where: { id: req.params.id },
      data: { modelName, description },
    });
    res.json(model);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.machineModel.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht.' });
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

export default router;
