const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CUSTOMERS = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
];
const VENDORS = ['44444444-4444-4444-4444-444444444444'];
const RIDERS = ['66666666-6666-6666-6666-666666666666'];

function rDate(daysOffset) {
    const d = new Date(); d.setDate(d.getDate() + daysOffset); return d;
}

async function main() {
    console.log('🌱 UPSERTING Order Service database (Non-destructive)...');

    const orders = [
        {
            id: 'aaaa1111-aaaa-1111-aaaa-1111aaaa1111',
            userId: CUSTOMERS[0], vendorId: VENDORS[0], riderId: RIDERS[0],
            status: 'delivered', totalAmount: 450,
            pickupTime: rDate(-4), deliveryTime: rDate(-2),
            pickupAddress: '12 Linking Road, Mumbai', deliveryAddress: '42 Powai, Mumbai',
            serviceType: 'Standard', paymentStatus: 'paid', hasIssue: false,
        },
        {
            id: 'bbbb2222-bbbb-2222-bbbb-2222bbbb2222',
            userId: CUSTOMERS[1], vendorId: VENDORS[0], riderId: RIDERS[0],
            status: 'processing', totalAmount: 850,
            pickupTime: rDate(-1), deliveryTime: rDate(1),
            pickupAddress: 'Andheri East, Mumbai', deliveryAddress: 'Andheri East, Mumbai',
            serviceType: 'Express 48h', paymentStatus: 'paid', hasIssue: true, issueType: 'stain', issueNote: 'Coffee stain'
        },
        {
            id: 'cccc3333-cccc-3333-cccc-3333cccc3333',
            userId: CUSTOMERS[2],
            status: 'pending', totalAmount: 1200,
            pickupTime: rDate(0), deliveryTime: rDate(1),
            pickupAddress: 'Saket Enclave, Delhi', deliveryAddress: 'Saket Enclave, Delhi',
            serviceType: 'Express 24h', paymentStatus: 'pending', hasIssue: false,
        }
    ];

    for (const data of orders) {
        await prisma.order.upsert({
            where: { id: data.id },
            update: {},
            create: data
        });
    }

    console.log('✅ 3 Orders upserted into Order Service (Database 3)!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
