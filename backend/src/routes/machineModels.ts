import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const includeAccessories = {
  compatibleAccessories: {
    include: { accessory: true },
    orderBy: { accessory: { name: 'asc' } },
  },
} as const;

function flatten(model: any) {
  return {
    ...model,
    compatibleAccessories: model.compatibleAccessories.map((ca: any) => ca.accessory),
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const [models, universalAccessories] = await Promise.all([
      prisma.machineModel.findMany({ include: includeAccessories, orderBy: { modelName: 'asc' } }),
      // Accessories with NO model assignment fit every machine
      prisma.accessory.findMany({ where: { compatibleModels: { none: {} } }, orderBy: { name: 'asc' } }),
    ]);

    res.json(models.map((m) => ({
      ...flatten(m),
      compatibleAccessories: [...m.compatibleAccessories.map((ca: any) => ca.accessory), ...universalAccessories],
    })));
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.post('/', requireRole('ADMIN', 'MANAGEMENT'), async (req, res) => {
  try {
    const { modelName, description, accessoryIds = [] } = req.body;
    const model = await prisma.machineModel.create({
      data: {
        modelName,
        description,
        compatibleAccessories: {
          create: (accessoryIds as string[]).map((id) => ({ accessoryId: id })),
        },
      },
      include: includeAccessories,
    });
    res.status(201).json(flatten(model));
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.put('/:id', requireRole('ADMIN', 'MANAGEMENT'), async (req, res) => {
  try {
    const { modelName, description, accessoryIds } = req.body;
    if (accessoryIds !== undefined) {
      await prisma.machineModelAccessory.deleteMany({ where: { machineModelId: req.params.id } });
    }
    const model = await prisma.machineModel.update({
      where: { id: req.params.id },
      data: {
        modelName,
        description,
        ...(accessoryIds !== undefined && {
          compatibleAccessories: {
            create: (accessoryIds as string[]).map((id) => ({ accessoryId: id })),
          },
        }),
      },
      include: includeAccessories,
    });
    res.json(flatten(model));
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.machineModel.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht.' });
  } catch (error: any) {
    if (error.code === 'P2003' || error.code === 'P2014') {
      return res.status(409).json({ message: 'Modell kann nicht gelöscht werden – es existieren noch Aufträge dazu.' });
    }
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

export default router;
