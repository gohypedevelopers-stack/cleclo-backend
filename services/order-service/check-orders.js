const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.order.count();
  const latest = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, status: true, totalAmount: true }
  });
  console.log('Total Orders:', count);
  console.log('Latest Orders:', JSON.stringify(latest, null, 2));
  process.exit(0);
}

check();
