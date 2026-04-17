/**
 * Seed script — creates or updates the default super admin user.
 * Run from the auth-service directory:
 *   node prisma/seed-admin.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email    = 'admin@cleclo.com';
    const password = 'password123';      // Change after first login!
    const name     = 'Admin User';
    const phone    = '9000000000';     // Placeholder — must be unique

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            role: 'admin',
            adminRole: 'super_admin',
            status: 'active',
            isVerified: true,
        },
        create: {
            name,
            email,
            phone,
            password: hashedPassword,
            role: 'admin',
            adminRole: 'super_admin',
            status: 'active',
            isVerified: true,
        },
    });

    console.log('✅ Admin user ready:');
    console.log(`   Email    : ${admin.email}`);
    console.log(`   Password : ${password}`);
    console.log(`   Role     : ${admin.role} / ${admin.adminRole}`);
    console.log(`   Status   : ${admin.status}`);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
