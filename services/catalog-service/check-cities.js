const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const cities = await prisma.cityConfig.findMany({
        where: { isEnabled: true }
    });
    console.log(JSON.stringify(cities, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
