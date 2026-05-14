const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DATA = {
  vendors: ["44444444-4444-4444-4444-444444444444", "55555555-5555-5555-5555-555555555555"],
  riders: ["r1-uuid-rahul", "r2-uuid-amit"],
  customers: ["alice-freeman-uuid-12345", "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "33333333-3333-3333-3333-333333333333"]
};

async function seed() {
  console.log("📦 Seeding Order Service with fixed IDs (Safely)...");

  const statuses = ["pending", "pickup_assigned", "picked_up", "received_by_vendor", "processing", "ready_for_delivery", "out_for_delivery", "delivered"];
  const serviceTypes = ["Standard", "Express 24h", "Express 48h"];

  for (let i = 0; i < 20; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const customerId = DATA.customers[Math.floor(Math.random() * DATA.customers.length)];
    const vendorId = Math.random() > 0.2 ? DATA.vendors[Math.floor(Math.random() * DATA.vendors.length)] : null;
    const riderId = Math.random() > 0.4 ? DATA.riders[Math.floor(Math.random() * DATA.riders.length)] : null;
    const total = 400 + Math.random() * 2000;

    await prisma.order.create({
      data: {
        userId: customerId,
        vendorId,
        riderId,
        status,
        totalAmount: total,
        subtotalAmount: total * 0.85,
        gstAmount: total * 0.15,
        serviceType: serviceTypes[Math.floor(Math.random() * serviceTypes.length)],
        paymentStatus: (status === "delivered" || Math.random() > 0.5) ? "paid" : "pending",
        pickupTime: new Date(),
        deliveryTime: new Date(Date.now() + 86400000 * 3),
        createdAt: new Date(Date.now() - Math.random() * 86400000 * 14),
        items: {
          create: [
            { itemId: "item-1", itemName: "Shirt", quantity: 2, unitPrice: 150, lineTotal: 300 },
            { itemId: "item-2", itemName: "Trousers", quantity: 1, unitPrice: 200, lineTotal: 200 }
          ]
        }
      }
    });
  }

  console.log("✅ Order Seed Completed!");
}

seed().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
