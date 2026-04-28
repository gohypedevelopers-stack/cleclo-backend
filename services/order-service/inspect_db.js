const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const c = await p.order.count();
  const o = await p.order.findMany({ 
    take: 10, 
    orderBy: { createdAt: 'desc' }
  });
  console.log('Total Orders:', c);
  console.log('Latest 10 Orders:', JSON.stringify(o, null, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
