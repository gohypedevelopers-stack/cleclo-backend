/**
 * Seed script — creates the Operations Admin and Finance Admin users.
 * Run from the auth-service directory:
 *   node prisma/seed-role-admins.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ADMINS = [
    {
        name: 'Operations Admin',
        email: 'opsadmin@cleclo.com',
        phone: '9000000002',
        password: 'OpsAdmin@123',
        adminRole: 'operations_admin'
    },
    {
        name: 'Finance Admin',
        email: 'financeadmin@cleclo.com',
        phone: '9000000003',
        password: 'FinanceAdmin@123',
        adminRole: 'finance_admin'
    }
];

async function main() {
    for (const admin of ADMINS) {
        const hashedPassword = await bcrypt.hash(admin.password, 10);

        const user = await prisma.user.upsert({
            where: { email: admin.email },
            update: {
                password: hashedPassword,
                role: 'admin',
                adminRole: admin.adminRole,
                status: 'active',
                isVerified: true
            },
            create: {
                name: admin.name,
                email: admin.email,
                phone: admin.phone,
                password: hashedPassword,
                role: 'admin',
                adminRole: admin.adminRole,
                status: 'active',
                isVerified: true
            }
        });

        console.log(`✅ ${admin.adminRole} ready:`);
        console.log(`   Email    : ${user.email}`);
        console.log(`   Password : ${admin.password}`);
        console.log(`   Role     : ${user.role} / ${user.adminRole}`);
        console.log(`   Status   : ${user.status}`);
        console.log('');
    }
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
