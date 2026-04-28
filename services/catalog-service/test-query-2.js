const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const videos = await prisma.homeVideo.findMany({
            select: {
                id: true,
                title: true,
                description: true,
                durationSeconds: true,
                views: true,
                isActive: true,
                thumbnailUrl: true,
                sortOrder: true,
                createdAt: true,
            },
            orderBy: { sortOrder: 'asc' }
        });
        console.log("Success");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
