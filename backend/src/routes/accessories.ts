import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const includeModels = {
  compatibleModels: {
    include: { machineModel: true },
    orderBy: { machineModel: { modelName: 'asc' } },
  },
} as const;

function flatten(acc: any) {
  return {
    ...acc,
    compatibleModels: acc.compatibleModels.map((cm: any) => cm.machineModel),
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const accessories = await prisma.accessory.findMany({
      include: includeModels,
      orderBy: { name: 'asc' },
    });
    res.json(accessories.map(flatten));
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, description, hasSerialNumber, machineModelIds = [] } = req.body;
    const accessory = await prisma.accessory.create({
      data: {
        name,
        description,
        hasSerialNumber: !!hasSerialNumber,
        compatibleModels: {
          create: (machineModelIds as string[]).map((id) => ({ machineModelId: id })),
        },
      },
      include: includeModels,
    });
    res.status(201).json(flatten(accessory));
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, description, hasSerialNumber, machineModelIds } = req.body;
    if (machineModelIds !== undefined) {
      await prisma.machineModelAccessory.deleteMany({ where: { accessoryId: req.params.id } });
    }
    const accessory = await prisma.accessory.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        hasSerialNumber: !!hasSerialNumber,
        ...(machineModelIds !== undefined && {
          compatibleModels: {
            create: (machineModelIds as string[]).map((id) => ({ machineModelId: id })),
          },
        }),
      },
      include: includeModels,
    });
    res.json(flatten(accessory));
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
      return res.status(409).json({ message: 'Zubehör ist noch in Aufträgen verwendet und kann nicht gelöscht werden.' });
    }
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

export default router;
