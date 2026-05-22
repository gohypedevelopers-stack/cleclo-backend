/**
 * Order Rich Seed — vendor weekly-activity data
 * Creates orders spread across Mon-Sun of the CURRENT week for the chart.
 * Safe to re-run (deletes [SEED] orders first).
 * Run: node prisma/seed-vendor-orders.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Must match the auth-service seed-vendor-data.js IDs
const VENDOR_IDS = [
  'aaaa0001-0000-0000-0000-000000000001', // Premium Wash
  'aaaa0002-0000-0000-0000-000000000002', // Quick Clean
  'aaaa0003-0000-0000-0000-000000000003', // Fresh Laundry
  'aaaa0004-0000-0000-0000-000000000004', // Sparkle Wash
  'aaaa0005-0000-0000-0000-000000000005', // Clean Express
];

const CUSTOMER_IDS = [
  'cccc0001-0000-0000-0000-000000000001',
  'cccc0002-0000-0000-0000-000000000002',
  'cccc0003-0000-0000-0000-000000000003',
  'cccc0004-0000-0000-0000-000000000004',
  'cccc0005-0000-0000-0000-000000000005',
  // Fallback to original seeded customers
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
];

const RIDER_IDS = [
  '66666666-6666-6666-6666-666666666666',
  '77777777-7777-7777-7777-777777777777',
];

const ITEM_IDS = [
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function weekDay(dayIndex, hour = 10) {
  const today = new Date();
  const dow = today.getDay() === 0 ? 7 : today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow - 1));
  monday.setHours(hour, 0, 0, 0);
  const target = new Date(monday);
  target.setDate(monday.getDate() + dayIndex);
  return target;
}

function isPast(dayIndex) {
  const d = weekDay(dayIndex);
  return d <= new Date();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Orders per vendor per day this week:
// Mon: V1,V2,V3 | Tue: V1,V2,V4 | Wed: V1,V3,V5 | Thu: V2,V4,V5 | Fri: V1,V2,V3,V4,V5
const WEEK_PLAN = [
  { dayIdx: 0, label: 'Mon', vendorIndices: [0, 1, 2], ordersPerVendor: 3 },
  { dayIdx: 1, label: 'Tue', vendorIndices: [0, 1, 3], ordersPerVendor: 4 },
  { dayIdx: 2, label: 'Wed', vendorIndices: [0, 2, 4], ordersPerVendor: 3 },
  { dayIdx: 3, label: 'Thu', vendorIndices: [1, 3, 4], ordersPerVendor: 4 },
  { dayIdx: 4, label: 'Fri', vendorIndices: [0, 1, 2, 3, 4], ordersPerVendor: 5 },
  { dayIdx: 5, label: 'Sat', vendorIndices: [0, 2, 4], ordersPerVendor: 2 },
  { dayIdx: 6, label: 'Sun', vendorIndices: [1, 3], ordersPerVendor: 2 },
];

const STATUSES = ['delivered', 'processing', 'out_for_delivery', 'picked_up', 'pickup_assigned', 'pending'];
const SERVICE_TYPES = ['Standard', 'Express 48h', 'Express 24h'];
const ADDRESSES = [
  '12 Linking Road, Bandra West, Mumbai',
  '56 Indiranagar Main, Bangalore',
  '3 Connaught Place, New Delhi',
  '18 Park Street, Kolkata',
  '88 Jubilee Hills, Hyderabad',
  '22 MG Road, Pune',
  '7 Anna Salai, Chennai',
];

async function main() {
  console.log('🌱 Seeding order service — vendor weekly activity data...\n');

  // Delete previously seeded orders (identified by issueNote containing [SEED])
  // We mark them via issueNote
  const deleted = await prisma.order.deleteMany({
    where: { issueNote: { startsWith: '[SEED]' } },
  });
  console.log(`🗑️  Removed ${deleted.count} old seed orders`);

  let totalCreated = 0;

  for (const day of WEEK_PLAN) {
    // Populate all days for a beautiful complete weekly curve in development
    for (const vi of day.vendorIndices) {
      const vendorId = VENDOR_IDS[vi];

      for (let o = 0; o < day.ordersPerVendor; o++) {
        const hour = rand(8, 20);
        const createdAt = weekDay(day.dayIdx, hour);
        const pickupTime = weekDay(day.dayIdx, hour + 1);
        const deliveryTime = weekDay(day.dayIdx + rand(1, 2), 14);
        const status = pick(STATUSES);
        const isDelivered = status === 'delivered';
        const address = pick(ADDRESSES);
        const totalAmount = rand(300, 1800);

        await prisma.order.create({
          data: {
            userId: pick(CUSTOMER_IDS),
            vendorId,
            riderId: pick(RIDER_IDS),
            status,
            totalAmount,
            pickupTime,
            deliveryTime,
            pickupAddress: address,
            deliveryAddress: address,
            serviceType: pick(SERVICE_TYPES),
            paymentStatus: isDelivered ? 'paid' : 'pending',
            hasIssue: false,
            issueNote: `[SEED] ${day.label} vendor-${vi + 1} order-${o + 1}`,
            createdAt,
            updatedAt: createdAt,
            items: {
              create: [
                { itemId: pick(ITEM_IDS), quantity: rand(1, 4), condition: 'None', riderVerified: isDelivered, vendorVerified: isDelivered },
                { itemId: pick(ITEM_IDS), quantity: rand(1, 3), condition: 'None', riderVerified: isDelivered, vendorVerified: isDelivered },
              ],
            },
          },
        });
        totalCreated++;
      }
    }
    console.log(`✅ ${day.label}: seeded orders for ${day.vendorIndices.length} vendors`);
  }

  // ── Also seed some historical orders (last 2 months) for revenue charts ──
  console.log('\n📅 Seeding 3-month historical orders...');
  let histCount = 0;

  for (let daysBack = 1; daysBack <= 90; daysBack++) {
    const ordersThisDay = rand(2, 8);
    for (let o = 0; o < ordersThisDay; o++) {
      const d = new Date();
      d.setDate(d.getDate() - daysBack);
      d.setHours(rand(8, 22), rand(0, 59), 0, 0);
      const totalAmount = rand(250, 2000);
      await prisma.order.create({
        data: {
          userId: pick(CUSTOMER_IDS),
          vendorId: pick(VENDOR_IDS),
          riderId: pick(RIDER_IDS),
          status: 'delivered',
          totalAmount,
          pickupTime: new Date(d.getTime() + 3600_000),
          deliveryTime: new Date(d.getTime() + 2 * 86400_000),
          pickupAddress: pick(ADDRESSES),
          deliveryAddress: pick(ADDRESSES),
          serviceType: pick(SERVICE_TYPES),
          paymentStatus: 'paid',
          hasIssue: false,
          issueNote: `[SEED] historical order`,
          createdAt: d,
          updatedAt: d,
          items: {
            create: [{ itemId: pick(ITEM_IDS), quantity: rand(1, 5), condition: 'None', riderVerified: true, vendorVerified: true }],
          },
        },
      });
      histCount++;
    }
  }

  console.log(`✅ Historical orders created: ${histCount}`);
  console.log(`\n🎉 Order seed complete!`);
  console.log(`   This-week orders : ${totalCreated}`);
  console.log(`   Historical orders: ${histCount}`);
  console.log(`   Total            : ${totalCreated + histCount}`);
}

main()
  .catch(e => { console.error('❌ Order seed failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
