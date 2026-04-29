const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const orders = await prisma.order.findMany({ take: 1 });
    console.log('Order reachable. Found order:', orders.length > 0 ? orders[0].id : 'none');
  } catch (error) {
    console.error('Order unreachable:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
