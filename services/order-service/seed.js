const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log("🧹 Clearing existing orders and order items...");
  await prisma.orderImage.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();

  console.log("📦 Seeding order service with specific customer segment criteria...");

  const vendorId = "44444444-4444-4444-4444-444444444444";
  const riderId = "r1-uuid-rahul";

  // Customer Segments Definition:
  // VIP -> Spend > ₹50,000 in last 30 days (Alice Freeman)
  // Gold -> Spend > ₹25,000 in last 30 days (Amit Patel)
  // Silver -> Spend > ₹12,500 in last 30 days (Priya Sharma)
  // At Risk -> No order in 30 days, but order in 60 days (Ravindra Kumar)
  // Dormant -> No order in 60 days (Sneha Reddy)

  const segmentOrders = [
    // --- VIP: Alice Freeman (id: 'alice-freeman-uuid-12345') ---
    // Total spent in last 30 days: ₹54,000
    {
      userId: "alice-freeman-uuid-12345",
      totalAmount: 22000,
      daysAgo: 5,
      status: "delivered",
      paymentStatus: "paid"
    },
    {
      userId: "alice-freeman-uuid-12345",
      totalAmount: 18000,
      daysAgo: 12,
      status: "delivered",
      paymentStatus: "paid"
    },
    {
      userId: "alice-freeman-uuid-12345",
      totalAmount: 14000,
      daysAgo: 20,
      status: "delivered",
      paymentStatus: "paid"
    },

    // --- Gold: Amit Patel (id: '33333333-3333-3333-3333-333333333333') ---
    // Total spent in last 30 days: ₹27,500
    {
      userId: "33333333-3333-3333-3333-333333333333",
      totalAmount: 16000,
      daysAgo: 8,
      status: "delivered",
      paymentStatus: "paid"
    },
    {
      userId: "33333333-3333-3333-3333-333333333333",
      totalAmount: 11500,
      daysAgo: 18,
      status: "delivered",
      paymentStatus: "paid"
    },

    // --- Silver: Priya Sharma (id: '22222222-2222-2222-2222-222222222222') ---
    // Total spent in last 30 days: ₹14,500
    {
      userId: "22222222-2222-2222-2222-222222222222",
      totalAmount: 8000,
      daysAgo: 10,
      status: "delivered",
      paymentStatus: "paid"
    },
    {
      userId: "22222222-2222-2222-2222-222222222222",
      totalAmount: 6500,
      daysAgo: 22,
      status: "delivered",
      paymentStatus: "paid"
    },

    // --- At Risk: Ravindra Kumar (id: '11111111-1111-1111-1111-111111111111') ---
    // Last order: 45 days ago. Spend in 30 days: ₹0.
    {
      userId: "11111111-1111-1111-1111-111111111111",
      totalAmount: 4000,
      daysAgo: 45,
      status: "delivered",
      paymentStatus: "paid"
    },

    // --- Dormant: Sneha Reddy (id: '44444444-4444-4444-4444-444444444445') ---
    // Last order: 75 days ago. Spend in 30 days: ₹0.
    {
      userId: "44444444-4444-4444-4444-444444444445",
      totalAmount: 2000,
      daysAgo: 75,
      status: "delivered",
      paymentStatus: "paid"
    }
  ];

  for (const ord of segmentOrders) {
    const createdDate = new Date(Date.now() - ord.daysAgo * 24 * 60 * 60 * 1000);
    const subtotal = ord.totalAmount * 0.85;
    const gst = ord.totalAmount * 0.15;

    await prisma.order.create({
      data: {
        userId: ord.userId,
        vendorId,
        riderId,
        status: ord.status,
        totalAmount: ord.totalAmount,
        subtotalAmount: subtotal,
        gstAmount: gst,
        serviceType: "Standard",
        paymentStatus: ord.paymentStatus,
        pickupTime: createdDate,
        deliveryTime: new Date(createdDate.getTime() + 86400000 * 2),
        createdAt: createdDate,
        items: {
          create: [
            { itemId: "item-premium-wash", itemName: "Premium Dry Cleaning Service", quantity: 1, unitPrice: ord.totalAmount, lineTotal: ord.totalAmount }
          ]
        }
      }
    });
  }

  console.log(`✅ Seeding complete! Created ${segmentOrders.length} specific orders.`);
}

seed()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
