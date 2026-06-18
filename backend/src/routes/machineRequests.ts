import { Router } from 'express';
import { RequestStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const INCLUDE_FULL = {
  salesRep: { select: { id: true, name: true, email: true, role: true } },
  customer: true,
  customerSite: true,
  machineModel: true,
  accessories: { include: { accessory: true } },
  statusLogs: {
    include: { changedBy: { select: { id: true, name: true, role: true } } },
    orderBy: { changedAt: 'asc' as const },
  },
};

async function generateRequestNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.machineRequest.count({
    where: { requestNumber: { startsWith: `ANF-${year}-` } },
  });
  return `ANF-${year}-${String(count + 1).padStart(4, '0')}`;
}

const VALID_TRANSITIONS: Record<string, RequestStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['IN_WAREHOUSE'],
  IN_WAREHOUSE: ['UNPACKING'],
  UNPACKING: ['CONFIGURING'],
  CONFIGURING: ['DONE'],
};

router.get('/', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status: status as RequestStatus } : {};
    const requests = await prisma.machineRequest.findMany({
      where,
      include: {
        salesRep: { select: { id: true, name: true, role: true } },
        customer: { select: { id: true, companyName: true, customerNumber: true } },
        customerSite: { select: { id: true, siteName: true, city: true } },
        machineModel: { select: { id: true, modelName: true } },
        accessories: { include: { accessory: { select: { id: true, name: true, hasSerialNumber: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const request = await prisma.machineRequest.findUnique({
      where: { id: req.params.id },
      include: INCLUDE_FULL,
    });
    if (!request) return res.status(404).json({ message: 'Anfrage nicht gefunden.' });
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { customerId, customerSiteId, machineModelId, notes, accessories } = req.body;
    const requestNumber = await generateRequestNumber();

    const request = await prisma.machineRequest.create({
      data: {
        requestNumber,
        status: 'DRAFT',
        salesRepId: req.session.userId!,
        customerId,
        customerSiteId,
        machineModelId,
        notes,
        accessories: accessories
          ? {
              create: accessories.map((a: { accessoryId: string; quantity: number }) => ({
                accessoryId: a.accessoryId,
                quantity: a.quantity || 1,
              })),
            }
          : undefined,
      },
      include: INCLUDE_FULL,
    });

    await prisma.statusLog.create({
      data: {
        requestId: request.id,
        toStatus: 'DRAFT',
        changedByUserId: req.session.userId!,
      },
    });

    res.status(201).json(request);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { notes, machineModelId, customerSiteId, accessories } = req.body;
    const existing = await prisma.machineRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Anfrage nicht gefunden.' });
    if (!['DRAFT', 'SUBMITTED'].includes(existing.status)) {
      return res.status(400).json({ message: 'Anfrage kann in diesem Status nicht bearbeitet werden.' });
    }

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;
    if (machineModelId) updateData.machineModelId = machineModelId;
    if (customerSiteId) updateData.customerSiteId = customerSiteId;

    if (accessories) {
      await prisma.requestAccessory.deleteMany({ where: { requestId: req.params.id } });
      updateData.accessories = {
        create: accessories.map((a: { accessoryId: string; quantity: number }) => ({
          accessoryId: a.accessoryId,
          quantity: a.quantity || 1,
        })),
      };
    }

    const request = await prisma.machineRequest.update({
      where: { id: req.params.id },
      data: updateData,
      include: INCLUDE_FULL,
    });
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.post('/:id/status', requireAuth, async (req, res) => {
  try {
    const { toStatus, comment, machineSerialNumber, accessories } = req.body;

    const request = await prisma.machineRequest.findUnique({
      where: { id: req.params.id },
      include: { accessories: { include: { accessory: true } } },
    });
    if (!request) return res.status(404).json({ message: 'Anfrage nicht gefunden.' });

    const allowed = VALID_TRANSITIONS[request.status] || [];
    if (!allowed.includes(toStatus as RequestStatus)) {
      return res.status(400).json({ message: `Übergang von ${request.status} zu ${toStatus} nicht erlaubt.` });
    }

    const updateData: Record<string, unknown> = { status: toStatus };
    if (machineSerialNumber) updateData.machineSerialNumber = machineSerialNumber;

    if (accessories && Array.isArray(accessories)) {
      for (const acc of accessories) {
        if (acc.id && acc.serialNumber !== undefined) {
          await prisma.requestAccessory.update({
            where: { id: acc.id },
            data: { serialNumber: acc.serialNumber },
          });
        }
      }
    }

    const updated = await prisma.machineRequest.update({
      where: { id: req.params.id },
      data: updateData,
      include: INCLUDE_FULL,
    });

    await prisma.statusLog.create({
      data: {
        requestId: request.id,
        fromStatus: request.status,
        toStatus: toStatus as RequestStatus,
        changedByUserId: req.session.userId!,
        comment,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

export default router;
