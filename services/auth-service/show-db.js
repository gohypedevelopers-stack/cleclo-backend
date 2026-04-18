const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Fetching users from PostgreSQL...");
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      status: true,
      userType: true
    }
  });
  console.table(users);
}

main().finally(() => prisma.$disconnect());
