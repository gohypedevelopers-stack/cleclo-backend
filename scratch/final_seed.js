const { PrismaClient: AuthPrisma } = require('../services/auth-service/node_modules/@prisma/client');
const { PrismaClient: OrderPrisma } = require('../services/order-service/node_modules/@prisma/client');

const authPrisma = new AuthPrisma({ datasources: { db: { url: "postgresql://postgres:postgres@localhost:5432/cleclo_auth?schema=public" } } });
const orderPrisma = new OrderPrisma({ datasources: { db: { url: "postgresql://postgres:postgres@localhost:5432/cleclo_orders?schema=public" } } });

async function seed() {
  console.log("🌱 Starting Seed...");

  // 1. Clear Data (Optional, but good for clean state)
  // await authPrisma.user.deleteMany({});
  // await orderPrisma.order.deleteMany({});

  // 2. Create Users
  const users = [
    { name: "Super Admin", email: "admin@cleclo.com", phone: "9999999999", role: "admin", adminRole: "super_admin" },
    { name: "Ops Manager", email: "ops@cleclo.com", phone: "8888888888", role: "admin", adminRole: "operations_admin" },
    { name: "Finance Lead", email: "finance@cleclo.com", phone: "7777777777", role: "admin", adminRole: "finance_admin" },
  ];

  const vendors = [
    { name: "Eco Cleaners", businessName: "Eco Cleaners Pvt Ltd", phone: "9876543210", email: "eco@cleclo.com" },
    { name: "Sparkle Dry", businessName: "Sparkle Dry Cleaning", phone: "9876543211", email: "sparkle@cleclo.com" },
    { name: "Premium Wash", businessName: "Premium Wash Services", phone: "9876543212", email: "premium@cleclo.com" },
  ];

  const riders = [
    { name: "Rahul Rider", phone: "9111111111", email: "rahul@cleclo.com" },
    { name: "Amit Rider", phone: "9111111112", email: "amit@cleclo.com" },
  ];

  const customers = [
    { name: "Aniket Singh", phone: "9000000001", email: "aniket@gmail.com" },
    { name: "Priya Sharma", phone: "9000000002", email: "priya@gmail.com" },
    { name: "Vikram Malhotra", phone: "9000000003", email: "vikram@gmail.com" },
  ];

  console.log("👤 Creating Admins...");
  for (const u of users) {
    await authPrisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: "Password123!" }
    });
  }

  console.log("🏪 Creating Vendors...");
  const vendorIds = [];
  for (const v of vendors) {
    const user = await authPrisma.user.upsert({
      where: { email: v.email },
      update: {},
      create: { 
        name: v.name, 
        email: v.email, 
        phone: v.phone, 
        role: "vendor", 
        password: "Password123!",
        vendorProfile: {
          create: {
            businessName: v.businessName,
            isApproved: true,
            commissionRate: 15,
            totalRevenue: Math.random() * 50000,
            rating: 4.5
          }
        },
        wallet: { create: { balance: 5000 } }
      }
    });
    vendorIds.push(user.id);
  }

  console.log("🏍️ Creating Riders...");
  const riderIds = [];
  for (const r of riders) {
    const user = await authPrisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: { name: r.name, email: r.email, phone: r.phone, role: "rider", password: "Password123!" }
    });
    riderIds.push(user.id);
  }

  console.log("👥 Creating Customers...");
  const customerIds = [];
  for (const c of customers) {
    const user = await authPrisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { 
        name: c.name, 
        email: c.email, 
        phone: c.phone, 
        role: "customer", 
        password: "Password123!",
        wallet: { create: { balance: 1000 } }
      }
    });
    customerIds.push(user.id);
  }

  console.log("📦 Creating Orders...");
  const statuses = ["pending", "pickup_assigned", "picked_up", "received_by_vendor", "processing", "ready_for_delivery", "out_for_delivery", "delivered"];
  const serviceTypes = ["Standard", "Express 24h", "Express 48h"];

  for (let i = 0; i < 20; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];
    const vendorId = Math.random() > 0.3 ? vendorIds[Math.floor(Math.random() * vendorIds.length)] : null;
    const riderId = Math.random() > 0.5 ? riderIds[Math.floor(Math.random() * riderIds.length)] : null;
    const total = 500 + Math.random() * 2000;

    await orderPrisma.order.create({
      data: {
        userId: customerId,
        vendorId,
        riderId,
        status,
        totalAmount: total,
        subtotalAmount: total * 0.8,
        gstAmount: total * 0.18,
        serviceType: serviceTypes[Math.floor(Math.random() * serviceTypes.length)],
        paymentStatus: status === "delivered" ? "paid" : "pending",
        pickupTime: new Date(),
        deliveryTime: new Date(Date.now() + 86400000 * 3),
        createdAt: new Date(Date.now() - Math.random() * 86400000 * 7),
        items: {
          create: [
            { itemName: "Shirt", quantity: 2, unitPrice: 150, lineTotal: 300 },
            { itemName: "Jeans", quantity: 1, unitPrice: 250, lineTotal: 250 }
          ]
        }
      }
    });
  }

  console.log("✅ Seed Completed!");
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await authPrisma.$disconnect();
  await orderPrisma.$disconnect();
});
