const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const services = await prisma.service.findMany({ take: 1 });
    console.log('Catalog reachable. Found service:', services.length > 0 ? services[0].name : 'none');
  } catch (error) {
    console.error('Catalog unreachable:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
