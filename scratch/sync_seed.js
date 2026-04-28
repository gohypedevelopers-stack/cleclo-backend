const { PrismaClient: AuthPrisma } = require('../services/auth-service/node_modules/@prisma/client');
const { PrismaClient: OrderPrisma } = require('../services/order-service/node_modules/@prisma/client');

const AUTH_DB = "postgresql://postgres:admin@123@localhost:5432/cleclo_auth?schema=public";
const ORDER_DB = "postgresql://postgres:admin@123@localhost:5432/cleclo_order?schema=public";

const auth = new AuthPrisma({ datasources: { db: { url: AUTH_DB } } });
const order = new OrderPrisma({ datasources: { db: { url: ORDER_DB } } });

async function clean() {
  console.log("🧹 Cleaning databases...");
  try {
    await order.orderItem.deleteMany({});
    await order.order.deleteMany({});
    console.log("✅ Orders cleared");
  } catch (e) { console.log("Note: Could not clear orders:", e.message); }
}

async function seed() {
  await clean();
  console.log("🌱 Seeding fresh data with Upsert...");

  const customerId = "cust-101-uuid";
  const vendorId = "vend-202-uuid";
  const riderId = "ride-303-uuid";

  // 1. Create/Update Users
  await auth.user.upsert({
    where: { phone: "9000000001" },
    update: { id: customerId, name: "Aniket Singh", email: "aniket@example.com", role: "customer" },
    create: {
      id: customerId,
      name: "Aniket Singh",
      email: "aniket@example.com",
      phone: "9000000001",
      role: "customer",
      password: "Password123!",
      wallet: { create: { balance: 1500 } }
    }
  });

  await auth.user.upsert({
    where: { phone: "9876543210" },
    update: { id: vendorId, name: "Eco Cleaners", email: "eco@example.com", role: "vendor" },
    create: {
      id: vendorId,
      name: "Eco Cleaners",
      email: "eco@example.com",
      phone: "9876543210",
      role: "vendor",
      password: "Password123!",
      vendorProfile: {
        create: {
          businessName: "Eco Cleaners Pvt Ltd",
          isApproved: true,
          commissionRate: 15,
          rating: 4.8
        }
      }
    }
  });

  await auth.user.upsert({
    where: { phone: "9111111111" },
    update: { id: riderId, name: "Rahul Express", email: "rahul@example.com", role: "rider" },
    create: {
      id: riderId,
      name: "Rahul Express",
      email: "rahul@example.com",
      phone: "9111111111",
      role: "rider",
      password: "Password123!"
    }
  });

  // 2. Create Orders
  const now = new Date();
  const statuses = ["pending", "picked_up", "processing", "ready_for_delivery", "delivered"];
  
  for (let i = 0; i < 15; i++) {
    const status = statuses[i % statuses.length];
    const orderDate = new Date(now);
    orderDate.setHours(now.getHours() - (i * 3));

    await order.order.create({
      data: {
        id: `ORD-NEW-${1000 + i}`,
        userId: customerId,
        vendorId: status === "pending" ? null : vendorId,
        riderId: riderId,
        status: status,
        totalAmount: 450 + (i * 50),
        subtotalAmount: 400 + (i * 50),
        gstAmount: 50,
        serviceType: i % 3 === 0 ? "Express 24h" : "Standard",
        paymentStatus: status === "delivered" ? "paid" : "pending",
        pickupTime: orderDate,
        deliveryTime: new Date(orderDate.getTime() + 86400000 * 2),
        createdAt: orderDate,
        items: {
          create: [
            { itemId: "item-wash", itemName: "Wash & Fold", quantity: 5, unitPrice: 80, lineTotal: 400, lineSubtotal: 400 }
          ]
        }
      }
    });
  }

  console.log("✅ Sync seed completed!");
}

seed().catch(console.error).finally(async () => {
  await auth.$disconnect();
  await order.$disconnect();
});
