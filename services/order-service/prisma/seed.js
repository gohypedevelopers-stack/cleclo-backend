const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ⚠️ IMPORTANT: These are placeholder UUIDs
// The seed will work with these, but if you want to link orders to real users:
// 1. Open Prisma Studio for auth-service: cd ../auth-service && npx prisma studio
// 2. Copy real user IDs from the User table
// 3. Replace the IDs below
// 4. Run this seed again

const PLACEHOLDER_CUSTOMER_IDS = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
];

const PLACEHOLDER_VENDOR_IDS = [
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
];

const PLACEHOLDER_RIDER_IDS = [
    '66666666-6666-6666-6666-666666666666',
    '77777777-7777-7777-7777-777777777777',
];

const PLACEHOLDER_ITEM_IDS = [
    '88888888-8888-8888-8888-888888888888',
    '99999999-9999-9999-9999-999999999999',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
];

function relativeDate(daysOffset, hour, minute = 0) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    date.setHours(hour, minute, 0, 0);
    return date;
}

async function main() {
    console.log('🌱 Seeding Order Service database...\n');
    console.log('ℹ️  Using placeholder IDs. Orders will be created but may not link to real users.');
    console.log('   To use real IDs, see instructions at the top of this file.\n');

    // 1. Create Delivered Order
    await prisma.order.create({
        data: {
            userId: PLACEHOLDER_CUSTOMER_IDS[0],
            vendorId: PLACEHOLDER_VENDOR_IDS[0],
            riderId: PLACEHOLDER_RIDER_IDS[0],
            status: 'delivered',
            totalAmount: 450,
            pickupTime: relativeDate(-4, 10),
            deliveryTime: relativeDate(-2, 18),
            pickupAddress: '12 Linking Road, Bandra West, Mumbai',
            deliveryAddress: '42 Hill View Apartments, Powai, Mumbai',
            serviceType: 'Standard',
            paymentStatus: 'paid',
            hasIssue: false,
            items: {
                create: [
                    {
                        itemId: PLACEHOLDER_ITEM_IDS[0],
                        quantity: 3,
                        condition: 'None',
                        riderVerified: true,
                        vendorVerified: true,
                        images: {
                            create: [
                                { imageUrl: '/uploads/order1-item1-1.jpg' },
                                { imageUrl: '/uploads/order1-item1-2.jpg' },
                            ],
                        },
                    },
                    {
                        itemId: PLACEHOLDER_ITEM_IDS[2],
                        quantity: 2,
                        condition: 'None',
                        riderVerified: true,
                        vendorVerified: true,
                        images: {
                            create: [
                                { imageUrl: '/uploads/order1-item2-1.jpg' },
                            ],
                        },
                    },
                ],
            },
        },
    });
    console.log('✅ Created order 1: Delivered');

    // 2. Create Processing Order
    await prisma.order.create({
        data: {
            userId: PLACEHOLDER_CUSTOMER_IDS[1],
            vendorId: PLACEHOLDER_VENDOR_IDS[0],
            riderId: PLACEHOLDER_RIDER_IDS[0],
            status: 'processing',
            totalAmount: 850,
            pickupTime: relativeDate(-1, 14),
            deliveryTime: relativeDate(1, 14),
            pickupAddress: '18 Palm Residency, Andheri East, Mumbai',
            deliveryAddress: '18 Palm Residency, Andheri East, Mumbai',
            serviceType: 'Express 48h',
            paymentStatus: 'paid',
            hasIssue: false,
            items: {
                create: [
                    {
                        itemId: PLACEHOLDER_ITEM_IDS[1],
                        quantity: 5,
                        condition: 'None',
                        riderVerified: true,
                        vendorVerified: true,
                    },
                    {
                        itemId: PLACEHOLDER_ITEM_IDS[3],
                        quantity: 2,
                        condition: 'Stain',
                        riderVerified: true,
                        vendorVerified: true,
                        discrepancy: 'Coffee stain on left pocket',
                        images: {
                            create: [
                                { imageUrl: '/uploads/order2-stain.jpg' },
                            ],
                        },
                    },
                ],
            },
        },
    });
    console.log('✅ Created order 2: Processing with stained item');

    // 3. Create Pending Order
    await prisma.order.create({
        data: {
            userId: PLACEHOLDER_CUSTOMER_IDS[2],
            status: 'pending',
            totalAmount: 1200,
            pickupTime: relativeDate(0, 11),
            deliveryTime: relativeDate(1, 20),
            pickupAddress: 'A-11 Saket Enclave, Saket, Delhi',
            deliveryAddress: 'A-11 Saket Enclave, Saket, Delhi',
            serviceType: 'Express 24h',
            paymentStatus: 'pending',
            hasIssue: false,
            items: {
                create: [
                    {
                        itemId: PLACEHOLDER_ITEM_IDS[4],
                        quantity: 2,
                    },
                    {
                        itemId: PLACEHOLDER_ITEM_IDS[0],
                        quantity: 4,
                    },
                ],
            },
        },
    });
    console.log('✅ Created order 3: Pending (no vendor/rider assigned)');

    // 4. Create Out for Delivery Order
    await prisma.order.create({
        data: {
            userId: PLACEHOLDER_CUSTOMER_IDS[1],
            vendorId: PLACEHOLDER_VENDOR_IDS[0],
            riderId: PLACEHOLDER_RIDER_IDS[1],
            status: 'out_for_delivery',
            totalAmount: 600,
            pickupTime: relativeDate(-2, 16),
            deliveryTime: relativeDate(0, 16),
            pickupAddress: '56 DLF Phase 2, Gurgaon',
            deliveryAddress: '56 DLF Phase 2, Gurgaon',
            serviceType: 'Standard',
            paymentStatus: 'paid',
            hasIssue: false,
            items: {
                create: [
                    {
                        itemId: PLACEHOLDER_ITEM_IDS[2],
                        quantity: 3,
                        condition: 'None',
                        riderVerified: true,
                        vendorVerified: true,
                    },
                ],
            },
        },
    });
    console.log('✅ Created order 4: Out for delivery');

    // 5. Create Order with Damage Issue
    await prisma.order.create({
        data: {
            userId: PLACEHOLDER_CUSTOMER_IDS[2],
            vendorId: PLACEHOLDER_VENDOR_IDS[1],
            riderId: PLACEHOLDER_RIDER_IDS[1],
            status: 'processing',
            totalAmount: 750,
            pickupTime: relativeDate(-3, 12),
            deliveryTime: relativeDate(0, 12),
            pickupAddress: '73 Residency Road, Indiranagar, Bangalore',
            deliveryAddress: '73 Residency Road, Indiranagar, Bangalore',
            serviceType: 'Standard',
            paymentStatus: 'paid',
            hasIssue: true,
            issueType: 'damage',
            issueNote: 'Button missing on shirt after dry cleaning',
            items: {
                create: [
                    {
                        itemId: PLACEHOLDER_ITEM_IDS[0],
                        quantity: 2,
                        condition: 'Damage',
                        riderVerified: true,
                        vendorVerified: true,
                        discrepancy: 'One shirt has missing button',
                        images: {
                            create: [
                                { imageUrl: '/uploads/order5-damage.jpg' },
                            ],
                        },
                    },
                    {
                        itemId: PLACEHOLDER_ITEM_IDS[1],
                        quantity: 4,
                        condition: 'None',
                        riderVerified: true,
                        vendorVerified: true,
                    },
                ],
            },
        },
    });
    console.log('✅ Created order 5: With damage issue');

    // 6. Create Cancelled Order
    await prisma.order.create({
        data: {
            userId: PLACEHOLDER_CUSTOMER_IDS[0],
            status: 'cancelled',
            totalAmount: 300,
            pickupTime: relativeDate(-2, 10),
            deliveryTime: relativeDate(1, 10),
            pickupAddress: '90 Sector 56, Gurgaon',
            deliveryAddress: '90 Sector 56, Gurgaon',
            serviceType: 'Standard',
            paymentStatus: 'refunded',
            hasIssue: true,
            issueType: 'customer_no_show',
            issueNote: 'Customer not available at pickup address',
            items: {
                create: [
                    {
                        itemId: PLACEHOLDER_ITEM_IDS[1],
                        quantity: 3,
                    },
                ],
            },
        },
    });
    console.log('✅ Created order 6: Cancelled (customer no-show)');

    // 7. Create Pickup Assigned Order
    await prisma.order.create({
        data: {
            userId: PLACEHOLDER_CUSTOMER_IDS[0],
            vendorId: PLACEHOLDER_VENDOR_IDS[0],
            riderId: PLACEHOLDER_RIDER_IDS[0],
            status: 'pickup_assigned',
            totalAmount: 350,
            pickupTime: relativeDate(0, 9),
            deliveryTime: relativeDate(3, 9),
            pickupAddress: '33 MG Road, Bengaluru',
            deliveryAddress: '33 MG Road, Bengaluru',
            serviceType: 'Standard',
            paymentStatus: 'pending',
            hasIssue: false,
            items: {
                create: [
                    {
                        itemId: PLACEHOLDER_ITEM_IDS[0],
                        quantity: 2,
                    },
                    {
                        itemId: PLACEHOLDER_ITEM_IDS[1],
                        quantity: 3,
                    },
                ],
            },
        },
    });
    console.log('✅ Created order 7: Pickup assigned');

    console.log('\n✅ Order Service seeding completed!');
    console.log('   - Created 7 orders with various statuses');
    console.log('   - Statuses: delivered, processing, pending, out_for_delivery, damaged, cancelled, pickup_assigned');
    console.log('\n💡 Note: Orders use placeholder IDs. To link to real users/items, update the IDs at the top of this file.');
}

main()
    .catch((e) => {
        console.error('\n❌ Error seeding database:', e.message);
        console.error('\nMake sure you:');
        console.error('  1. Ran migrations: npx prisma migrate dev');
        console.error('  2. PostgreSQL is running');
        console.error('  3. Database connection in .env is correct\n');
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
