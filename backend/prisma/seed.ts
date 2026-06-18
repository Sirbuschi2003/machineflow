import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const existingAdmin = await prisma.salesRep.findFirst({ where: { role: 'ADMIN' } });
  if (existingAdmin) {
    console.log('Datenbank bereits befüllt, überspringe Seed...');
    return;
  }

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  // Users
  const admin = await prisma.salesRep.create({
    data: { name: 'Admin User', email: 'admin@machineflow.de', passwordHash: hash('admin123'), role: 'ADMIN' },
  });
  const sales1 = await prisma.salesRep.create({
    data: { name: 'Anna Müller', email: 'anna@machineflow.de', passwordHash: hash('sales123'), role: 'SALES' },
  });
  const sales2 = await prisma.salesRep.create({
    data: { name: 'Ben Schmidt', email: 'ben@machineflow.de', passwordHash: hash('sales123'), role: 'SALES' },
  });
  const warehouse = await prisma.salesRep.create({
    data: { name: 'Karl Lager', email: 'lager@machineflow.de', passwordHash: hash('lager123'), role: 'WAREHOUSE' },
  });
  const technician = await prisma.salesRep.create({
    data: { name: 'Tom Technik', email: 'tech@machineflow.de', passwordHash: hash('tech123'), role: 'TECHNICIAN' },
  });
  const management = await prisma.salesRep.create({
    data: { name: 'Maria Leitung', email: 'leitung@machineflow.de', passwordHash: hash('mgmt123'), role: 'MANAGEMENT' },
  });

  // Machine Models
  const model1 = await prisma.machineModel.create({
    data: { modelName: 'CopierPro 3000', description: 'Hochleistungs-Kopierer für große Büros' },
  });
  const model2 = await prisma.machineModel.create({
    data: { modelName: 'PrintMaster 5000', description: 'Industriedrucker mit Duplexfunktion' },
  });
  const model3 = await prisma.machineModel.create({
    data: { modelName: 'ScanFlow X200', description: 'Multifunktionsgerät mit Farbscanner' },
  });
  const model4 = await prisma.machineModel.create({
    data: { modelName: 'OfficePrint 1500', description: 'Kompakter Bürodrucker' },
  });

  // Accessories
  const acc1 = await prisma.accessory.create({
    data: { name: 'Zusatzpapierfach A4', description: '500-Blatt Zusatzfach', hasSerialNumber: false },
  });
  const acc2 = await prisma.accessory.create({
    data: { name: 'Finisher-Einheit', description: 'Automatischer Sortierer und Hefter', hasSerialNumber: true },
  });
  const acc3 = await prisma.accessory.create({
    data: { name: 'Netzwerkkarte', description: 'Gigabit-Ethernet-Erweiterungskarte', hasSerialNumber: true },
  });
  const acc4 = await prisma.accessory.create({
    data: { name: 'Toner-Set (5er Pack)', description: 'Original-Toner-Ersatzkartuschen', hasSerialNumber: false },
  });
  const acc5 = await prisma.accessory.create({
    data: { name: 'Unterschrank', description: 'Stabiler Rollunterschrank mit Schloss', hasSerialNumber: false },
  });
  const acc6 = await prisma.accessory.create({
    data: { name: 'Fax-Modul', description: 'Integriertes Fax-Erweiterungsmodul', hasSerialNumber: true },
  });

  // Customers
  const customer1 = await prisma.customer.create({
    data: {
      customerNumber: 'K-10001',
      companyName: 'Mustermann GmbH',
      phone: '+49 211 12345678',
      email: 'kontakt@mustermann-gmbh.de',
      sites: {
        create: [
          {
            siteName: 'Hauptsitz',
            street: 'Musterstraße 1',
            zip: '40213',
            city: 'Düsseldorf',
            country: 'Deutschland',
            isPrimary: true,
          },
          {
            siteName: 'Zweigstelle Nord',
            street: 'Nordring 22',
            zip: '20095',
            city: 'Hamburg',
            country: 'Deutschland',
            isPrimary: false,
          },
        ],
      },
    },
    include: { sites: true },
  });

  const customer2 = await prisma.customer.create({
    data: {
      customerNumber: 'K-10002',
      companyName: 'Beispiel AG',
      phone: '+49 30 98765432',
      email: 'info@beispiel-ag.de',
      sites: {
        create: [
          {
            siteName: 'Zentrale',
            street: 'Berliner Allee 100',
            zip: '10115',
            city: 'Berlin',
            country: 'Deutschland',
            isPrimary: true,
          },
        ],
      },
    },
    include: { sites: true },
  });

  const customer3 = await prisma.customer.create({
    data: {
      customerNumber: 'K-10003',
      companyName: 'TechCorp Solutions KG',
      phone: '+49 89 55512345',
      email: 'office@techcorp.de',
      sites: {
        create: [
          {
            siteName: 'München HQ',
            street: 'Maximilianstraße 45',
            zip: '80539',
            city: 'München',
            country: 'Deutschland',
            isPrimary: true,
          },
          {
            siteName: 'Niederlassung Frankfurt',
            street: 'Mainzer Landstr. 50',
            zip: '60325',
            city: 'Frankfurt am Main',
            country: 'Deutschland',
            isPrimary: false,
          },
        ],
      },
    },
    include: { sites: true },
  });

  // Sample MachineRequests
  const req1 = await prisma.machineRequest.create({
    data: {
      requestNumber: 'ANF-2024-0001',
      status: 'DONE',
      salesRepId: sales1.id,
      customerId: customer1.id,
      customerSiteId: customer1.sites[0].id,
      machineModelId: model1.id,
      machineSerialNumber: 'CP3000-SN-88201',
      notes: 'Dringend benötigt bis Ende des Monats',
      accessories: {
        create: [
          { accessoryId: acc1.id, quantity: 2 },
          { accessoryId: acc2.id, quantity: 1, serialNumber: 'FIN-2024-001' },
        ],
      },
    },
  });

  await prisma.statusLog.createMany({
    data: [
      { requestId: req1.id, fromStatus: null, toStatus: 'DRAFT', changedByUserId: sales1.id },
      { requestId: req1.id, fromStatus: 'DRAFT', toStatus: 'SUBMITTED', changedByUserId: sales1.id },
      { requestId: req1.id, fromStatus: 'SUBMITTED', toStatus: 'IN_WAREHOUSE', changedByUserId: management.id, comment: 'Genehmigt' },
      { requestId: req1.id, fromStatus: 'IN_WAREHOUSE', toStatus: 'UNPACKING', changedByUserId: warehouse.id },
      { requestId: req1.id, fromStatus: 'UNPACKING', toStatus: 'CONFIGURING', changedByUserId: technician.id },
      { requestId: req1.id, fromStatus: 'CONFIGURING', toStatus: 'DONE', changedByUserId: technician.id, comment: 'Konfiguration abgeschlossen' },
    ],
  });

  const req2 = await prisma.machineRequest.create({
    data: {
      requestNumber: 'ANF-2024-0002',
      status: 'IN_WAREHOUSE',
      salesRepId: sales2.id,
      customerId: customer2.id,
      customerSiteId: customer2.sites[0].id,
      machineModelId: model2.id,
      notes: 'Netzwerkkarte erforderlich',
      accessories: {
        create: [
          { accessoryId: acc3.id, quantity: 1 },
          { accessoryId: acc4.id, quantity: 1 },
        ],
      },
    },
  });

  await prisma.statusLog.createMany({
    data: [
      { requestId: req2.id, fromStatus: null, toStatus: 'DRAFT', changedByUserId: sales2.id },
      { requestId: req2.id, fromStatus: 'DRAFT', toStatus: 'SUBMITTED', changedByUserId: sales2.id },
      { requestId: req2.id, fromStatus: 'SUBMITTED', toStatus: 'IN_WAREHOUSE', changedByUserId: management.id },
    ],
  });

  const req3 = await prisma.machineRequest.create({
    data: {
      requestNumber: 'ANF-2024-0003',
      status: 'SUBMITTED',
      salesRepId: sales1.id,
      customerId: customer3.id,
      customerSiteId: customer3.sites[0].id,
      machineModelId: model3.id,
      accessories: {
        create: [
          { accessoryId: acc5.id, quantity: 1 },
          { accessoryId: acc6.id, quantity: 1 },
        ],
      },
    },
  });

  await prisma.statusLog.createMany({
    data: [
      { requestId: req3.id, fromStatus: null, toStatus: 'DRAFT', changedByUserId: sales1.id },
      { requestId: req3.id, fromStatus: 'DRAFT', toStatus: 'SUBMITTED', changedByUserId: sales1.id },
    ],
  });

  const req4 = await prisma.machineRequest.create({
    data: {
      requestNumber: 'ANF-2024-0004',
      status: 'DRAFT',
      salesRepId: sales2.id,
      customerId: customer1.id,
      customerSiteId: customer1.sites[1].id,
      machineModelId: model4.id,
      notes: 'Lieferung an Zweigstelle',
      accessories: {
        create: [{ accessoryId: acc1.id, quantity: 1 }],
      },
    },
  });

  await prisma.statusLog.create({
    data: { requestId: req4.id, fromStatus: null, toStatus: 'DRAFT', changedByUserId: sales2.id },
  });

  const req5 = await prisma.machineRequest.create({
    data: {
      requestNumber: 'ANF-2024-0005',
      status: 'CONFIGURING',
      salesRepId: sales1.id,
      customerId: customer3.id,
      customerSiteId: customer3.sites[1].id,
      machineModelId: model1.id,
      machineSerialNumber: 'CP3000-SN-88202',
      accessories: {
        create: [
          { accessoryId: acc2.id, quantity: 1, serialNumber: 'FIN-2024-002' },
          { accessoryId: acc3.id, quantity: 1, serialNumber: 'NET-2024-001' },
        ],
      },
    },
  });

  await prisma.statusLog.createMany({
    data: [
      { requestId: req5.id, fromStatus: null, toStatus: 'DRAFT', changedByUserId: sales1.id },
      { requestId: req5.id, fromStatus: 'DRAFT', toStatus: 'SUBMITTED', changedByUserId: sales1.id },
      { requestId: req5.id, fromStatus: 'SUBMITTED', toStatus: 'IN_WAREHOUSE', changedByUserId: management.id },
      { requestId: req5.id, fromStatus: 'IN_WAREHOUSE', toStatus: 'UNPACKING', changedByUserId: warehouse.id },
      { requestId: req5.id, fromStatus: 'UNPACKING', toStatus: 'CONFIGURING', changedByUserId: technician.id },
    ],
  });

  // More DONE requests for statistics
  const req6 = await prisma.machineRequest.create({
    data: {
      requestNumber: 'ANF-2024-0006',
      status: 'DONE',
      salesRepId: sales2.id,
      customerId: customer2.id,
      customerSiteId: customer2.sites[0].id,
      machineModelId: model2.id,
      machineSerialNumber: 'PM5000-SN-55101',
      accessories: { create: [{ accessoryId: acc4.id, quantity: 2 }] },
    },
  });

  const req7 = await prisma.machineRequest.create({
    data: {
      requestNumber: 'ANF-2024-0007',
      status: 'DONE',
      salesRepId: sales1.id,
      customerId: customer3.id,
      customerSiteId: customer3.sites[0].id,
      machineModelId: model3.id,
      machineSerialNumber: 'SFX200-SN-33401',
      accessories: { create: [] },
    },
  });

  console.log('Seed erfolgreich abgeschlossen!');
  console.log('\nBenutzer-Zugangsdaten:');
  console.log('  Admin:      admin@machineflow.de     / admin123');
  console.log('  Vertrieb:   anna@machineflow.de      / sales123');
  console.log('  Vertrieb:   ben@machineflow.de       / sales123');
  console.log('  Lager:      lager@machineflow.de     / lager123');
  console.log('  Techniker:  tech@machineflow.de      / tech123');
  console.log('  Leitung:    leitung@machineflow.de   / mgmt123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
