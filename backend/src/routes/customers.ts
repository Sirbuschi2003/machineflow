import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/lookup/:customerNumber', requireAuth, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { customerNumber: req.params.customerNumber },
      include: { sites: { orderBy: { isPrimary: 'desc' } } },
    });
    if (!customer) {
      return res.status(404).json({ message: 'Kunde nicht gefunden.' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      include: { sites: { orderBy: { isPrimary: 'desc' } } },
      orderBy: { companyName: 'asc' },
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.post('/', requireRole('ADMIN', 'SALES', 'MANAGEMENT'), async (req, res) => {
  try {
    const { customerNumber, companyName, phone, email, sites } = req.body;
    const customer = await prisma.customer.create({
      data: {
        customerNumber,
        companyName,
        phone,
        email,
        sites: sites ? { create: sites } : undefined,
      },
      include: { sites: true },
    });
    res.status(201).json(customer);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Kundennummer bereits vergeben.' });
    }
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const { companyName, phone, email } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { companyName, phone, email },
      include: { sites: { orderBy: { isPrimary: 'desc' } } },
    });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.post('/:id/sites', requireRole('ADMIN'), async (req, res) => {
  try {
    const { siteName, street, zip, city, country, isPrimary } = req.body;
    if (isPrimary) {
      await prisma.customerSite.updateMany({
        where: { customerId: req.params.id },
        data: { isPrimary: false },
      });
    }
    const site = await prisma.customerSite.create({
      data: { customerId: req.params.id, siteName, street, zip, city, country: country || 'Deutschland', isPrimary: !!isPrimary },
    });
    res.status(201).json(site);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ message: 'Gelöscht.' });
  } catch (error: any) {
    if (error.code === 'P2003' || error.code === 'P2014') {
      return res.status(409).json({ message: 'Kunde kann nicht gelöscht werden – es existieren noch Aufträge für diesen Kunden.' });
    }
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

router.put('/sites/:siteId', requireAuth, async (req, res) => {
  try {
    const { siteName, street, zip, city, country, isPrimary } = req.body;
    const existing = await prisma.customerSite.findUnique({ where: { id: req.params.siteId } });
    if (!existing) return res.status(404).json({ message: 'Standort nicht gefunden.' });

    if (isPrimary) {
      await prisma.customerSite.updateMany({
        where: { customerId: existing.customerId },
        data: { isPrimary: false },
      });
    }
    const site = await prisma.customerSite.update({
      where: { id: req.params.siteId },
      data: { siteName, street, zip, city, country, isPrimary: !!isPrimary },
    });
    res.json(site);
  } catch (error) {
    res.status(500).json({ message: 'Interner Serverfehler.' });
  }
});

export default router;
