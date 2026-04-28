const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Querying homeVideo...");
        const videos = await prisma.homeVideo.findMany();
        console.log("Videos:", videos);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
