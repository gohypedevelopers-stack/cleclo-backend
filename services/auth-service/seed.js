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

  // Seed support tickets for all 8 feedback types
  console.log("🎫 Seeding Support Tickets...");
  const supportTickets = [
    {
      id: "t1-bug",
      userId: "c1-uuid-aniket",
      targetId: "v1-uuid-eco",
      subject: "App crashes on add money ORD-9921",
      category: "Bug",
      message: "The app crashes when I try to add money to my wallet. This happens every time I enter an amount above ₹1000.",
      priority: "critical",
      status: "open",
    },
    {
      id: "t2-feature",
      userId: "c2-uuid-priya",
      targetId: null,
      subject: "Recurring order feature ORD-8821",
      category: "Feature Request",
      message: "It would be great to have a recurring order option for weekly laundry pickup.",
      priority: "medium",
      status: "open",
    },
    {
      id: "t3-complaint",
      userId: "c1-uuid-aniket",
      targetId: "v2-uuid-sparkle",
      subject: "Late delivery with missing items ORD-8234",
      category: "Service Complaint",
      message: "My order was delivered late and some items were missing. Order #ORD-8234.",
      priority: "high",
      status: "resolved",
      resolvedAt: new Date(Date.now() - 3600000 * 2),
    },
    {
      id: "t4-rider",
      userId: "c2-uuid-priya",
      targetId: "v1-uuid-eco",
      subject: "Rude rider behavior ORD-7721",
      category: "Rider Behavior",
      message: "The rider was extremely rude and refused to come to the doorstep despite the instructions.",
      priority: "high",
      status: "open",
    },
    {
      id: "t5-payment",
      userId: "c1-uuid-aniket",
      targetId: null,
      subject: "Double deduction issue ORD-6621",
      category: "Payment Issue",
      message: "Amount was deducted twice for my last order. Please refund one transaction.",
      priority: "medium",
      status: "resolved",
      resolvedAt: new Date(Date.now() - 3600000 * 4),
    },
    {
      id: "t6-vendor",
      userId: "c2-uuid-priya",
      targetId: "v1-uuid-eco",
      subject: "Chemical smell in clothes ORD-5542",
      category: "Vendor Quality",
      message: "The clothes returned from Clean Express - Andheri West had a strong chemical smell, and two white shirts had yellow spots. Very poor washing quality.",
      priority: "high",
      status: "open",
    },
    {
      id: "t7-uiux",
      userId: "c1-uuid-aniket",
      targetId: null,
      subject: "Order tracker font size ORD-4431",
      category: "App UI/UX",
      message: "The new UI is beautiful, but the font size in the order details screen is way too small. It makes it hard to read the item breakdown.",
      priority: "low",
      status: "open",
    },
    {
      id: "t8-suggestion",
      userId: "c2-uuid-priya",
      targetId: null,
      subject: "Multiple addresses option ORD-3320",
      category: "Suggestion",
      message: "It would be amazing if we could add multiple drop-off and pick-up locations in our profile instead of having to type them manually every time.",
      priority: "low",
      status: "open",
    }
  ];

  for (const t of supportTickets) {
    try {
      await prisma.supportTicket.upsert({
        where: { id: t.id },
        update: t,
        create: t
      });
    } catch (e) {
      console.log(`Skipping support ticket ${t.subject}: ${e.message}`);
    }
  }

  console.log("✅ Auth Seed Completed!");
}

seed().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

