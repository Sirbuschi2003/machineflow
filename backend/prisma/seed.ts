import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.salesRep.findFirst({ where: { role: 'ADMIN' } });
  if (existing) {
    console.log('Admin bereits vorhanden, überspringe Seed.');
    return;
  }

  await prisma.salesRep.create({
    data: {
      name: 'Administrator',
      email: 'admin@admin.de',
      passwordHash: bcrypt.hashSync('admin123', 10),
      role: 'ADMIN',
    },
  });

  console.log('Admin-Benutzer angelegt: admin@admin.de / admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
