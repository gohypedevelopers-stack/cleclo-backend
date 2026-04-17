const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const identifier = 'admin@cleclo.com';
    
    // Clear failed attempts
    const deleteAttempts = await prisma.adminLoginAttempt.deleteMany({
        where: { identifier }
    });
    
    // Clear challenges
    const deleteChallenges = await prisma.adminAuthChallenge.deleteMany({
        where: { identifier }
    });

    console.log(`Cleared ${deleteAttempts.count} attempts and ${deleteChallenges.count} challenges for ${identifier}`);
}

main().finally(() => prisma.$disconnect());
