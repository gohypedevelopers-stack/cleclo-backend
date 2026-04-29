const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@cleclo.com' }
    });
    console.log('User found:', user ? { ...user, password: '[REDACTED]' } : 'null');
    
    const allUsers = await prisma.user.findMany({
        take: 5
    });
    console.log('Sample users:', allUsers.map(u => ({ email: u.email, role: u.role })));

  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
