const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const u = await prisma.user.count();
        const a = await prisma.user.count({where: {role: 'admin'}});
        const v = await prisma.user.count({where: {role: 'vendor'}});
        const r = await prisma.user.count({where: {role: 'rider'}});
        const set = await prisma.vendorSettlement.count();
        const tick = await prisma.supportTicket.count();
        
        console.log(`Auth Service DB Status:`);
        console.log(`- Total Users: ${u}`);
        console.log(`- Admins: ${a}`);
        console.log(`- Vendors: ${v}`);
        console.log(`- Riders: ${r}`);
        console.log(`- Vendor Settlements: ${set}`);
        console.log(`- Support Tickets: ${tick}`);
    } catch(e) {
        console.log('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
check();
