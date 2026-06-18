import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/auth';

const router = Router();

router.get('/machines-by-year', requireRole('MANAGEMENT', 'ADMIN'), async (req, res) => {
  try {
    const { modelId } = req.query;

    const where: Record<string, unknown> = { status: 'DONE' };
    if (modelId) where.machineModelId = modelId as string;

    const results = await prisma.$queryRawUnsafe<
      { year: number; modelId: string; modelName: string; count: number }[]
    >(`
      SELECT
        EXTRACT(YEAR FROM mr."updatedAt")::int AS year,
        mm.id AS "modelId",
        mm."modelName",
        COUNT(*)::int AS count
      FROM "MachineRequest" mr
      JOIN "MachineModel" mm ON mr."machineModelId" = mm.id
      WHERE mr.status = 'DONE'
      ${modelId ? `AND mr."machineModelId" = '${modelId}'` : ''}
      GROUP BY year, mm.id, mm."modelName"
      ORDER BY year ASC, mm."modelName" ASC
    `);

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.get('/sales-by-rep', requireRole('MANAGEMENT', 'ADMIN'), async (req, res) => {
  try {
    const { year } = req.query;

    const yearFilter = year
      ? `AND EXTRACT(YEAR FROM mr."updatedAt") = ${parseInt(year as string)}`
      : '';

    const results = await prisma.$queryRawUnsafe<
      { repId: string; repName: string; count: number }[]
    >(`
      SELECT
        sr.id AS "repId",
        sr.name AS "repName",
        COUNT(mr.id)::int AS count
      FROM "SalesRep" sr
      LEFT JOIN "MachineRequest" mr
        ON sr.id = mr."salesRepId"
        AND mr.status = 'DONE'
        ${yearFilter}
      WHERE sr.role = 'SALES'
      GROUP BY sr.id, sr.name
      ORDER BY count DESC, sr.name ASC
    `);

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.get('/summary', requireRole('MANAGEMENT', 'ADMIN', 'SALES', 'WAREHOUSE', 'TECHNICIAN'), async (req, res) => {
  try {
    const counts = await prisma.machineRequest.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const summary = counts.reduce(
      (acc, c) => {
        acc[c.status] = c._count.id;
        return acc;
      },
      {} as Record<string, number>
    );
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

export default router;
