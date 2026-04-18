const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 UPSERTING Auth Service database (Non-destructive)...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create Admin Users
    const adminUsers = [
        { name: 'Super Admin', email: 'admin@cleclo.com', phone: '9999999999', adminRole: 'super_admin' },
        { name: 'Operations Admin', email: 'operations.admin@cleclo.com', phone: '9999999998', adminRole: 'operations_admin' },
        { name: 'Finance Admin', email: 'finance.admin@cleclo.com', phone: '9999999997', adminRole: 'finance_admin' },
    ];

    for (const adminData of adminUsers) {
        await prisma.user.upsert({
            where: { email: adminData.email },
            update: {},
            create: {
                name: adminData.name,
                email: adminData.email,
                phone: adminData.phone,
                password: hashedPassword,
                role: 'admin',
                adminRole: adminData.adminRole,
                status: 'active',
                userType: 'regular',
                isVerified: true,
                addresses: {
                    create: [
                        { addressLine: '123 Admin Street, Mumbai', lat: 19.0760, lng: 72.8777, type: 'work' },
                    ],
                },
                wallet: { create: { balance: 10000 } },
            },
        });
    }
    console.log('✅ Admins upserted.');

    // 2. Create Regular Customers
    const customerNames = [
        { id: '11111111-1111-1111-1111-111111111111', name: 'Ravindra Kumar', email: 'ravindra@example.com', phone: '9876543210', type: 'vip' },
        { id: '22222222-2222-2222-2222-222222222222', name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543211', type: 'regular' },
        { id: '33333333-3333-3333-3333-333333333333', name: 'Amit Patel', email: 'amit@example.com', phone: '9876543212', type: 'top_spender' },
        { name: 'Sneha Reddy', email: 'sneha@example.com', phone: '9876543213', type: 'regular' },
    ];

    for (const data of customerNames) {
        await prisma.user.upsert({
            where: { email: data.email },
            update: {},
            create: {
                id: data.id,
                name: data.name,
                email: data.email,
                phone: data.phone,
                password: hashedPassword,
                role: 'customer',
                status: 'active',
                userType: data.type,
                isVerified: true,
                addresses: {
                    create: [
                        { addressLine: `Main Road, Mumbai`, lat: 19.0760, lng: 72.8777, type: 'home' },
                    ],
                },
                wallet: { create: { balance: 5000 } },
            },
        });
    }
    console.log('✅ Customers upserted.');

    // 3. Create Vendors
    const vendorData = [
        {
            id: '44444444-4444-4444-4444-444444444444',
            name: 'Vendor 1 - Mumbai Laundry',
            email: 'vendor1@cleclo.com',
            phone: '9111111111',
            businessName: 'Mumbai Premium Laundry',
            isApproved: true,
        },
        {
            id: '55555555-5555-5555-5555-555555555555',
            name: 'Vendor 2 - Express Clean',
            email: 'vendor2@cleclo.com',
            phone: '9222222222',
            businessName: 'Express Clean Services',
            isApproved: true,
        },
        {
            name: 'Vendor 4 - Pending Approval',
            email: 'vendor4@cleclo.com',
            phone: '9444444444',
            businessName: 'New Laundry Startup',
            isApproved: false,
        }
    ];

    for (const vData of vendorData) {
        await prisma.user.upsert({
            where: { email: vData.email },
            update: {},
            create: {
                id: vData.id,
                name: vData.name,
                email: vData.email,
                phone: vData.phone,
                password: hashedPassword,
                role: 'vendor',
                status: vData.isApproved ? 'active' : 'pending',
                isVerified: true,
                vendorProfile: {
                    create: {
                        businessName: vData.businessName,
                        servicesOffered: 'Dry Clean, Wash Only',
                        dailyCapacity: 150,
                        commissionRate: 18,
                        isApproved: vData.isApproved,
                        bankVerified: vData.isApproved,
                        termsAccepted: true,
                        slaAccepted: true,
                    }
                },
                wallet: { create: { balance: 0 } },
            },
        });
    }
    console.log('✅ Vendors upserted.');

    // 4. Create Riders
    const riderData = [
        {
            id: '66666666-6666-6666-6666-666666666666',
            name: 'Rider 1 - Ramesh',
            email: 'rider1@cleclo.com',
            phone: '8111111111',
            isApproved: true,
        },
        {
            name: 'Rider 4 - Pending',
            email: 'rider4@cleclo.com',
            phone: '8444444444',
            isApproved: false,
        }
    ];

    for (const rData of riderData) {
        await prisma.user.upsert({
            where: { email: rData.email },
            update: {},
            create: {
                id: rData.id,
                name: rData.name,
                email: rData.email,
                phone: rData.phone,
                password: hashedPassword,
                role: 'rider',
                status: rData.isApproved ? 'active' : 'pending',
                isVerified: true,
                wallet: { create: { balance: 0 } },
                vendorProfile: {
                    create: {
                        businessName: rData.name,
                        businessType: 'rider',
                        isApproved: rData.isApproved,
                        bankVerified: rData.isApproved,
                        termsAccepted: true,
                        slaAccepted: true,
                    }
                }
            },
        });
    }
    console.log('✅ Riders upserted.');
    console.log('🎉 Seeding successfully finished without deleting existing records!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
