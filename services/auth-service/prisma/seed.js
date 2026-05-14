const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Cleaning and Seeding Auth Service database...');

    // Clear existing data to avoid unique constraint errors during demo seeding
    await prisma.supportTicket.deleteMany();
    await prisma.address.deleteMany();
    await prisma.walletTransaction.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.outlet.deleteMany();
    await prisma.vendorProfile.deleteMany();
    await prisma.vendorSettlement.deleteMany();
    await prisma.adminLoginEvent.deleteMany();
    await prisma.adminLoginAttempt.deleteMany();
    await prisma.adminAuthChallenge.deleteMany();
    await prisma.paymentMethod.deleteMany();
    await prisma.loyaltyHistory.deleteMany();
    await prisma.user.deleteMany();

    // Hash password for all users
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create Admin Users
    const adminUsers = [
        {
            name: 'Super Admin',
            email: 'admin@cleclo.com',
            phone: '9999999999',
            adminRole: 'super_admin',
        },
        {
            name: 'Operations Admin',
            email: 'operations.admin@cleclo.com',
            phone: '9999999998',
            adminRole: 'operations_admin',
        },
        {
            name: 'Finance Admin',
            email: 'finance.admin@cleclo.com',
            phone: '9999999997',
            adminRole: 'finance_admin',
        },
    ];

    const admins = [];

    for (const adminData of adminUsers) {
        const admin = await prisma.user.create({
            data: {
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
                        {
                            addressLine: '123 Admin Street, Mumbai',
                            lat: 19.0760,
                            lng: 72.8777,
                            type: 'work',
                        },
                    ],
                },
                wallet: {
                    create: {
                        balance: 10000,
                    },
                },
            },
        });

        admins.push(admin);
    }

    // 2. Create Regular Customers (10 customers)
    const customers = [];
    const customerNames = [
        { id: 'alice-freeman-uuid-12345', name: 'Alice Freeman', email: 'alice@example.com', phone: '9898989898', type: 'vip' },
        { id: '11111111-1111-1111-1111-111111111111', name: 'Ravindra Kumar', email: 'ravindra@example.com', phone: '9876543210', type: 'vip' },
        { id: '22222222-2222-2222-2222-222222222222', name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543211', type: 'regular' },
        { id: '33333333-3333-3333-3333-333333333333', name: 'Amit Patel', email: 'amit@example.com', phone: '9876543212', type: 'top_spender' },
        { name: 'Sneha Reddy', email: 'sneha@example.com', phone: '9876543213', type: 'regular' },
    ];

    for (const customerData of customerNames) {
        const customer = await prisma.user.create({
            data: {
                name: customerData.name,
                id: customerData.id,
                email: customerData.email,
                phone: customerData.phone,
                password: hashedPassword,
                role: 'customer',
                status: 'active',
                userType: customerData.type,
                isVerified: true,
                addresses: {
                    create: [
                        {
                            addressLine: `${Math.floor(Math.random() * 999) + 1} Main Road, Mumbai`,
                            lat: 19.0760 + (Math.random() - 0.5) * 0.1,
                            lng: 72.8777 + (Math.random() - 0.5) * 0.1,
                            type: 'home',
                        },
                        {
                            addressLine: `${Math.floor(Math.random() * 999) + 1} Office Complex, Mumbai`,
                            lat: 19.0760 + (Math.random() - 0.5) * 0.1,
                            lng: 72.8777 + (Math.random() - 0.5) * 0.1,
                            type: 'work',
                        },
                    ],
                },
                wallet: {
                    create: {
                        balance: Math.floor(Math.random() * 5000) + 500,
                        transactions: {
                            create: [
                                {
                                    amount: 1000,
                                    type: 'credit',
                                    note: 'Welcome bonus',
                                },
                                {
                                    amount: 500,
                                    type: 'debit',
                                    note: 'Order payment #12345',
                                },
                            ],
                        },
                    },
                },
            },
        });
        customers.push(customer);
    }

    // 3. Create Vendors (5 vendors)
    const vendorData = [
        {
            id: '44444444-4444-4444-4444-444444444444',
            name: 'Vendor 1 - Mumbai Laundry',
            email: 'vendor1@cleclo.com',
            phone: '9111111111',
            businessName: 'Mumbai Premium Laundry',
            servicesOffered: 'Dry Clean, Wash Only, Iron',
            dailyCapacity: 150,
            commissionRate: 18,
            isApproved: true,
            bankVerified: true,
            termsAccepted: true,
            slaAccepted: true,
            ownerIdProofUrl: 'https://example.com/vendor1-owner-id.pdf',
            businessProofUrl: 'https://example.com/vendor1-business-proof.pdf',
            lat: 19.0760,
            lng: 72.8777,
        },
        {
            id: '55555555-5555-5555-5555-555555555555',
            name: 'Vendor 2 - Express Clean',
            email: 'vendor2@cleclo.com',
            phone: '9222222222',
            businessName: 'Express Clean Services',
            servicesOffered: 'Dry Clean, Wash Only',
            dailyCapacity: 100,
            commissionRate: 17,
            isApproved: true,
            bankVerified: true,
            termsAccepted: true,
            slaAccepted: true,
            ownerIdProofUrl: 'https://example.com/vendor2-owner-id.pdf',
            businessProofUrl: 'https://example.com/vendor2-business-proof.pdf',
            lat: 19.1136,
            lng: 72.8697,
        },
        {
            name: 'Vendor 3 - Quick Wash',
            email: 'vendor3@cleclo.com',
            phone: '9333333333',
            businessName: 'Quick Wash Pro',
            servicesOffered: 'Wash Only, Iron',
            dailyCapacity: 200,
            commissionRate: 16,
            isApproved: true,
            bankVerified: true,
            termsAccepted: true,
            slaAccepted: true,
            ownerIdProofUrl: 'https://example.com/vendor3-owner-id.pdf',
            businessProofUrl: 'https://example.com/vendor3-business-proof.pdf',
            lat: 19.0596,
            lng: 72.8295,
        },
        {
            name: 'Vendor 4 - Pending Approval',
            email: 'vendor4@cleclo.com',
            phone: '9444444444',
            businessName: 'New Laundry Startup',
            servicesOffered: 'Dry Clean, Wash Only, Iron',
            dailyCapacity: 80,
            commissionRate: 15,
            isApproved: false,
            bankVerified: false,
            termsAccepted: false,
            slaAccepted: false,
            ownerIdProofUrl: 'https://example.com/vendor4-owner-id.pdf',
            businessProofUrl: 'https://example.com/vendor4-business-proof.pdf',
            lat: 19.0330,
            lng: 72.8569,
            createdAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000), // 95 days ago
        },
        {
            name: 'Vendor 5 - Elite Dry Clean',
            email: 'vendor5@cleclo.com',
            phone: '9555555555',
            businessName: 'Elite Dry Cleaners',
            servicesOffered: 'Dry Clean',
            dailyCapacity: 120,
            commissionRate: 19,
            isApproved: true,
            bankVerified: false,
            termsAccepted: true,
            slaAccepted: true,
            ownerIdProofUrl: 'https://example.com/vendor5-owner-id.pdf',
            businessProofUrl: 'https://example.com/vendor5-business-proof.pdf',
            lat: 19.0895,
            lng: 72.8634,
        },
    ];

    const vendors = [];
    for (const vData of vendorData) {
        const vendor = await prisma.user.create({
            data: {
                name: vData.name,
                id: vData.id,
                email: vData.email,
                phone: vData.phone,
                password: hashedPassword,
                role: 'vendor',
                status: 'active',
                isVerified: true,
                createdAt: vData.createdAt || new Date(),
                addresses: {
                    create: [
                        {
                            addressLine: `${vData.businessName} HQ`,
                            lat: vData.lat,
                            lng: vData.lng,
                            type: 'work',
                        },
                    ],
                },
                vendorProfile: {
                    create: {
                        businessName: vData.businessName,
                        gstRegistered: true,
                        gstNumber: `GST${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
                        businessType: 'LLP',
                        servicesOffered: vData.servicesOffered,
                        dailyCapacity: vData.dailyCapacity,
                        commissionRate: vData.commissionRate,
                        bankHolderName: vData.name,
                        bankName: 'HDFC Bank',
                        accountNumber: `${Math.floor(Math.random() * 9000000000) + 1000000000}`,
                        ifscCode: 'HDFC0001234',
                        bankVerified: vData.bankVerified,
                        businessProofUrl: vData.businessProofUrl,
                        ownerIdProofUrl: vData.ownerIdProofUrl,
                        termsAccepted: vData.termsAccepted,
                        slaAccepted: vData.slaAccepted,
                        isApproved: vData.isApproved,
                    },
                },
                outlets: {
                    create: [
                        {
                            name: `${vData.businessName} - Main Branch`,
                            address: `${Math.floor(Math.random() * 999) + 1} Commercial St, Mumbai`,
                            lat: vData.lat,
                            lng: vData.lng,
                            operatingHours: '09:00-21:00',
                        },
                    ],
                },
                wallet: {
                    create: {
                        balance: Math.floor(Math.random() * 50000) + 10000,
                    },
                },
            },
        });
        vendors.push(vendor);

        // Create settlements for approved vendors
        if (vData.isApproved) {
            await prisma.vendorSettlement.createMany({
                data: [
                    {
                        vendorId: vendor.id,
                        amount: 5000,
                        grossAmount: 6500,
                        commissionAmount: 1500,
                        orderCount: 18,
                        status: 'PAID',
                        note: 'Weekly payout - Week 1',
                        transactionReference: `SETTLE-${String(vendor.id).replace(/-/g, '').slice(0, 8).toUpperCase()}-01`,
                        periodStart: new Date('2026-01-01'),
                        periodEnd: new Date('2026-01-15'),
                        processedAt: new Date('2026-01-25'),
                        paidAt: new Date('2026-01-25'),
                    },
                    {
                        vendorId: vendor.id,
                        amount: 7500,
                        grossAmount: 9300,
                        commissionAmount: 1800,
                        orderCount: 24,
                        status: 'PENDING',
                        note: 'Weekly payout - Week 2',
                        transactionReference: `SETTLE-${String(vendor.id).replace(/-/g, '').slice(0, 8).toUpperCase()}-02`,
                        periodStart: new Date('2026-01-16'),
                        periodEnd: new Date('2026-01-31'),
                    },
                ],
            });
        }
    }

    // 4. Create Riders (3 riders)
    const riders = [];
    const riderNames = [
        { id: '66666666-6666-6666-6666-666666666666', name: 'Rahul Rider', email: 'rahul.rider@cleclo.com', phone: '9811111111' },
        { id: '77777777-7777-7777-7777-777777777777', name: 'Arun Delivery', email: 'arun.delivery@cleclo.com', phone: '9822222222' },
        { name: 'Deepak Driver', email: 'deepak.driver@cleclo.com', phone: '9833333333' },
    ];

    for (const riderData of riderNames) {
        const rider = await prisma.user.create({
            data: {
                name: riderData.name,
                id: riderData.id,
                email: riderData.email,
                phone: riderData.phone,
                password: hashedPassword,
                role: 'rider',
                status: 'active',
                isVerified: true,
                wallet: {
                    create: {
                        balance: Math.floor(Math.random() * 2000) + 500,
                    },
                },
            },
        });
        riders.push(rider);
    }

    // 5. Create Support Tickets
    await prisma.supportTicket.createMany({
        data: [
            {
                userId: customers[0].id,
                targetId: null, // Admin ticket
                subject: 'Order delayed',
                category: 'orders',
                message: 'My order #12345 is delayed by 2 days. Please help.',
                priority: 'high',
                status: 'in_progress',
            },
            {
                userId: customers[1].id,
                targetId: vendors[0].id, // Vendor specific
                subject: 'Item damaged',
                category: 'orders',
                message: 'My shirt was damaged during cleaning.',
                priority: 'high',
                status: 'open',
            },
            {
                userId: vendors[0].id,
                targetId: null, // Admin ticket
                subject: 'Payment not received',
                category: 'payments',
                message: 'Settlement amount not credited to account.',
                priority: 'medium',
                status: 'resolved',
                resolvedAt: new Date(),
            },
            {
                userId: customers[2].id,
                targetId: null,
                subject: 'Account verification',
                category: 'account',
                message: 'Unable to verify my phone number.',
                priority: 'low',
                status: 'open',
            },
            {
                userId: customers[3].id,
                targetId: null,
                subject: 'App not working',
                category: 'technical',
                message: 'App crashes when I try to upload photos.',
                priority: 'medium',
                status: 'open',
                isEscalated: true,
            },
        ],
    });

    // 6. Create Vendor Settlements
    const settlementData = [];
    for (let i = 0; i < vendors.length; i++) {
        const vendor = vendors[i];
        if (i % 2 === 0) {
            // Completed settlement
            settlementData.push({
                vendorId: vendor.id,
                amount: 5420.50,
                grossAmount: 6500.00,
                commissionAmount: 1079.50,
                orderCount: 12,
                status: 'PAID',
                paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                periodStart: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
                periodEnd: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            });
        }
        
        // Pending settlement
        settlementData.push({
            vendorId: vendor.id,
            amount: 2840.00,
            grossAmount: 3400.00,
            commissionAmount: 560.00,
            orderCount: 8,
            status: 'PENDING',
            periodStart: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            periodEnd: new Date(),
        });
    }

    await prisma.vendorSettlement.createMany({
        data: settlementData
    });

    console.log(`   - Created ${settlementData.length} settlements`);
    console.log('✅ Auth Service seeding completed!');
    console.log(`   - Created ${admins.length} admins`);
    console.log(`   - Created ${customers.length} customers`);
    console.log(`   - Created ${vendors.length} vendors`);
    console.log(`   - Created ${riders.length} riders`);
    console.log(`   - Created 5 support tickets`);
    console.log(`   - Default password for all users: password123`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
