const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DATA = {
  vendors: [
    { id: "v1-uuid-eco", name: "Eco Cleaners", businessName: "Eco Cleaners Pvt Ltd", phone: "9876543110", email: "eco@cleclo.com" },
    { id: "v2-uuid-sparkle", name: "Sparkle Dry", businessName: "Sparkle Dry Cleaning", phone: "9876543111", email: "sparkle@cleclo.com" },
  ],
  riders: [
    { id: "r1-uuid-rahul", name: "Rahul Rider", phone: "9111111222", email: "rahul@cleclo.com" },
    { id: "r2-uuid-amit", name: "Amit Rider", phone: "9111111333", email: "amit@cleclo.com" },
  ],
  customers: [
    { id: "c1-uuid-aniket", name: "Aniket Singh", phone: "9000000444", email: "aniket@gmail.com" },
    { id: "c2-uuid-priya", name: "Priya Sharma", phone: "9000000555", email: "priya@gmail.com" },
  ]
};

async function seed() {
  console.log("👤 Seeding Auth Service with unique phones...");

  const admins = [
    { id: "a1-uuid-super", name: "Super Admin", email: "admin@cleclo.com", phone: "9999999000", role: "admin", adminRole: "super_admin" },
  ];

  for (const u of admins) {
    try {
      await prisma.user.upsert({
        where: { email: u.email },
        update: { id: u.id, name: u.name, phone: u.phone, role: u.role, adminRole: u.adminRole },
        create: { ...u, password: "Password123!" }
      });
    } catch (e) { console.log(`Skipping admin ${u.name}: ${e.message}`); }
  }

  for (const v of DATA.vendors) {
    try {
      await prisma.user.upsert({
        where: { email: v.email },
        update: { id: v.id, name: v.name, phone: v.phone },
        create: { 
          id: v.id,
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
              totalRevenue: 25000,
              rating: 4.5
            }
          },
          wallet: { create: { balance: 5000 } }
        }
      });
    } catch (e) { console.log(`Skipping vendor ${v.name}: ${e.message}`); }
  }

  for (const r of DATA.riders) {
    try {
      await prisma.user.upsert({
        where: { email: r.email },
        update: { id: r.id, name: r.name, phone: r.phone },
        create: { id: r.id, name: r.name, email: r.email, phone: r.phone, role: "rider", password: "Password123!" }
      });
    } catch (e) { console.log(`Skipping rider ${r.name}: ${e.message}`); }
  }

  for (const c of DATA.customers) {
    try {
      await prisma.user.upsert({
        where: { email: c.email },
        update: { id: c.id, name: c.name, phone: c.phone },
        create: { 
          id: c.id,
          name: c.name, 
          email: c.email, 
          phone: c.phone, 
          role: "customer", 
          registrationSource: c.name === "Priya Sharma" ? "referral" : "organic",
          password: "Password123!",
          wallet: { create: { balance: 1000 } }
        }
      });
    } catch (e) { console.log(`Skipping customer ${c.name}: ${e.message}`); }
  }

  console.log("✅ Auth Seed Completed!");
}

seed().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
