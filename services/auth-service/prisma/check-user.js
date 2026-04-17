const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'admin@cleclo.com' }
    });
    if (user) {
        console.log('User found:', {
            id: user.id,
            email: user.email,
            role: user.role,
            adminRole: user.adminRole,
            status: user.status
        });
    } else {
        console.log('User NOT found');
    }
}

main().finally(() => prisma.$disconnect());
