const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CUSTOMERS = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '33333333-4444-4444-4444-444444444444',
    '33333333-5555-5555-5555-555555555555'
];
const VENDORS = [
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    '44444444-3333-3333-3333-333333333333'
];
const RIDERS = [
    '66666666-6666-6666-6666-666666666666',
    '66666666-7777-7777-7777-777777777777',
    '66666666-8888-8888-8888-888888888888'
];

function rDate(hoursOffset) {
    const d = new Date(); d.setHours(d.getHours() + hoursOffset); return d;
}

async function main() {
    console.log('🌱 UPSERTING Order Service database with dashboard test cases...');

    const orders = [
        // 1. Delivered normally
        {
            id: 'ord-1111', userId: CUSTOMERS[0], vendorId: VENDORS[0], riderId: RIDERS[0],
            status: 'delivered', totalAmount: 450,
            createdAt: rDate(-48), pickupTime: rDate(-40), deliveryTime: rDate(-2),
            pickupAddress: 'Linking Road, Mumbai', deliveryAddress: 'Powai, Mumbai',
            serviceType: 'Standard', paymentStatus: 'paid', hasIssue: false,
        },
        // 2. SLA Breached Express
        {
            id: 'ord-2222', userId: CUSTOMERS[1], vendorId: VENDORS[1], riderId: RIDERS[1],
            status: 'processing', totalAmount: 850,
            createdAt: rDate(-30), pickupTime: rDate(-28),
            pickupAddress: 'Andheri East, Mumbai', deliveryAddress: 'Andheri East, Mumbai',
            serviceType: 'Express 24h', paymentStatus: 'paid', hasIssue: false,
        },
        // 3. Unassigned (Pending Allocation)
        {
            id: 'ord-3333', userId: CUSTOMERS[2], vendorId: VENDORS[0],
            status: 'pending', totalAmount: 1200,
            createdAt: rDate(-4),
            pickupAddress: 'Saket Enclave, Delhi', deliveryAddress: 'Saket Enclave, Delhi',
            serviceType: 'Standard', paymentStatus: 'pending', hasIssue: false,
        },
        // 4. Issue Reported (Damage)
        {
            id: 'ord-4444', userId: CUSTOMERS[3], vendorId: VENDORS[2], riderId: RIDERS[2],
            status: 'issue_reported', totalAmount: 3200,
            createdAt: rDate(-12), pickupTime: rDate(-10),
            pickupAddress: 'Bandra West, Mumbai', deliveryAddress: 'Bandra West, Mumbai',
            serviceType: 'Standard', paymentStatus: 'paid', hasIssue: true, issueType: 'damage', issueNote: 'Silk saree torn during wash'
        },
        // 5. Processing Standard (SLA safe)
        {
            id: 'ord-5555', userId: CUSTOMERS[4], vendorId: VENDORS[1], riderId: RIDERS[0],
            status: 'received_by_vendor', totalAmount: 650,
            createdAt: rDate(-10), pickupTime: rDate(-8),
            pickupAddress: 'Koramangala, BLR', deliveryAddress: 'Koramangala, BLR',
            serviceType: 'Standard', paymentStatus: 'paid', hasIssue: false,
        },
        // 6. Out for delivery
        {
            id: 'ord-6666', userId: CUSTOMERS[0], vendorId: VENDORS[0], riderId: RIDERS[1],
            status: 'picked_up', totalAmount: 1800,
            createdAt: rDate(-50), pickupTime: rDate(-48),
            pickupAddress: 'Marine Drive, Mumbai', deliveryAddress: 'Marine Drive, Mumbai',
            serviceType: 'Standard', paymentStatus: 'paid', hasIssue: false,
        }
    ];

    for (const data of orders) {
        await prisma.order.upsert({
            where: { id: data.id },
            update: {
                status: data.status,
                createdAt: data.createdAt,
                hasIssue: data.hasIssue,
                issueType: data.issueType
            },
            create: data
        });
    }

    console.log('✅ 6 Dynamic Orders upserted into Order Service!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
