const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 UPSERTING Auth Service database with comprehensive dashboard data...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Admin Users
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
                name: adminData.name, email: adminData.email, phone: adminData.phone,
                password: hashedPassword, role: 'admin', adminRole: adminData.adminRole,
                status: 'active', isVerified: true,
                wallet: { create: { balance: 0 } },
            },
        });
    }
    console.log('✅ Admins upserted.');

    // 2. Customers
    const customers = [
        { id: '11111111-1111-1111-1111-111111111111', name: 'Ravindra Kumar', email: 'ravindra@example.com', phone: '9876543210', wallet: 2500, createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        { id: '22222222-2222-2222-2222-222222222222', name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543211', wallet: 45000, createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) },
        { id: '33333333-3333-3333-3333-333333333333', name: 'Amit Patel', email: 'amit@example.com', phone: '9876543212', wallet: 12000, createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) },
        { id: '33333333-4444-4444-4444-444444444444', name: 'Sneha Reddy', email: 'sneha@example.com', phone: '9876543213', wallet: 0, createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) },
        { id: '33333333-5555-5555-5555-555555555555', name: 'Rohan Gupta', email: 'rohan@example.com', phone: '9876543214', wallet: 100, createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    ];

    for (const data of customers) {
        await prisma.user.upsert({
            where: { email: data.email },
            update: { createdAt: data.createdAt },
            create: {
                id: data.id, name: data.name, email: data.email, phone: data.phone,
                password: hashedPassword, role: 'customer', status: 'active', isVerified: true,
                createdAt: data.createdAt,
                wallet: { create: { balance: data.wallet } },
            },
        });
    }
    console.log('✅ Customers upserted.');

    // 3. Vendors
    const vendors = [
        { id: '44444444-4444-4444-4444-444444444444', name: 'Mumbai Laundry', email: 'vendor1@cleclo.com', phone: '9111111111', isApproved: true, comm: 18, balance: 12500 },
        { id: '55555555-5555-5555-5555-555555555555', name: 'Express Clean', email: 'vendor2@cleclo.com', phone: '9222222222', isApproved: true, comm: 20, balance: 4200 },
        { id: '44444444-3333-3333-3333-333333333333', name: 'Premium Wash', email: 'vendor3@cleclo.com', phone: '9333333333', isApproved: true, comm: 15, balance: 8900 },
        { id: '44444444-2222-2222-2222-222222222222', name: 'Eco Laundry', email: 'vendor4@cleclo.com', phone: '9444444444', isApproved: false, comm: 18, balance: 0 },
    ];

    for (const v of vendors) {
        await prisma.user.upsert({
            where: { email: v.email },
            update: {
                vendorProfile: {
                    update: { commissionRate: v.comm, isApproved: v.isApproved }
                }
            },
            create: {
                id: v.id, name: v.name, email: v.email, phone: v.phone,
                password: hashedPassword, role: 'vendor', status: v.isApproved ? 'active' : 'pending', isVerified: true,
                vendorProfile: {
                    create: { businessName: v.name, commissionRate: v.comm, isApproved: v.isApproved, bankVerified: v.isApproved, termsAccepted: true, slaAccepted: true }
                },
                wallet: { create: { balance: v.balance } },
            },
        });
    }
    console.log('✅ Vendors upserted.');

    // 4. Riders
    const riders = [
        { id: '66666666-6666-6666-6666-666666666666', name: 'Ramesh Singh', email: 'rider1@cleclo.com', phone: '8111111111', isApproved: true, balance: 1500 },
        { id: '66666666-7777-7777-7777-777777777777', name: 'Suresh Kumar', email: 'rider2@cleclo.com', phone: '8222222222', isApproved: true, balance: 800 },
        { id: '66666666-8888-8888-8888-888888888888', name: 'Vikram Das', email: 'rider3@cleclo.com', phone: '8333333333', isApproved: true, balance: 3200 },
        { id: '66666666-9999-9999-9999-999999999999', name: 'Rahul Dev', email: 'rider4@cleclo.com', phone: '8444444444', isApproved: false, balance: 0 },
    ];

    for (const r of riders) {
        await prisma.user.upsert({
            where: { email: r.email },
            update: {},
            create: {
                id: r.id, name: r.name, email: r.email, phone: r.phone,
                password: hashedPassword, role: 'rider', status: r.isApproved ? 'active' : 'pending', isVerified: true,
                wallet: { create: { balance: r.balance } },
                vendorProfile: {
                    create: { businessName: r.name, businessType: 'rider', isApproved: r.isApproved, bankVerified: r.isApproved, termsAccepted: true, slaAccepted: true }
                }
            },
        });
    }
    console.log('✅ Riders upserted.');

    // 5. Vendor Settlements
    const settlements = [
        { id: 'ST-001', vendorId: vendors[0].id, amount: 8200, gross: 10000, comm: 1800, count: 45, status: 'PAID' },
        { id: 'ST-002', vendorId: vendors[1].id, amount: 3360, gross: 4200, comm: 840, count: 12, status: 'PENDING' },
        { id: 'ST-003', vendorId: vendors[2].id, amount: 7565, gross: 8900, comm: 1335, count: 28, status: 'PROCESSING' },
        { id: 'ST-004', vendorId: vendors[0].id, amount: 12500, gross: 15243, comm: 2743, count: 62, status: 'PENDING' },
    ];

    for (const s of settlements) {
        await prisma.vendorSettlement.upsert({
            where: { id: s.id },
            update: {},
            create: {
                id: s.id, vendorId: s.vendorId, amount: s.amount, grossAmount: s.gross,
                commissionAmount: s.comm, orderCount: s.count, status: s.status,
                periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                periodEnd: new Date(),
                paidAt: s.status === 'PAID' ? new Date() : null,
                transactionReference: s.status === 'PAID' ? 'TXN-999999' : null,
                penalties: Math.random() > 0.5 ? 200 : 0
            }
        });
    }
    console.log('✅ Settlements upserted.');

    console.log('🎉 Auth Service DB Seeding Finished!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
