require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function monitor() {
  const count = await prisma.order.count();
  console.log(`Current Order Count: ${count}`);
}

monitor();
