/**
 * Vendor Rich Seed — safe to re-run (upsert-based)
 * Populates: vendors, settlements, support tickets with realistic data
 * Run: node prisma/seed-vendor-data.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// ─── Fixed UUIDs so upserts are idempotent ───────────────────────────────────
const VENDOR_IDS = {
  premiumWash:    'aaaa0001-0000-0000-0000-000000000001',
  quickClean:     'aaaa0002-0000-0000-0000-000000000002',
  freshLaundry:   'aaaa0003-0000-0000-0000-000000000003',
  sparkleWash:    'aaaa0004-0000-0000-0000-000000000004',
  cleanExpress:   'aaaa0005-0000-0000-0000-000000000005',
  eliteCleaners:  'aaaa0006-0000-0000-0000-000000000006',
};

const CUSTOMER_IDS = {
  c1: 'cccc0001-0000-0000-0000-000000000001',
  c2: 'cccc0002-0000-0000-0000-000000000002',
  c3: 'cccc0003-0000-0000-0000-000000000003',
  c4: 'cccc0004-0000-0000-0000-000000000004',
  c5: 'cccc0005-0000-0000-0000-000000000005',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function weekDay(dayIndex, hour = 10) {
  // dayIndex: 0=Mon, 1=Tue, … 6=Sun of current week
  const today = new Date();
  const dow = today.getDay() === 0 ? 7 : today.getDay(); // Mon=1…Sun=7
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow - 1));
  monday.setHours(hour, 0, 0, 0);
  const target = new Date(monday);
  target.setDate(monday.getDate() + dayIndex);
  return target;
}

function daysAgo(n, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('🌱 Seeding rich vendor data...\n');
  const hashedPw = await bcrypt.hash('password123', 10);

  // ─── 1. Extra Customers ───────────────────────────────────────────────────
  const customerDefs = [
    { id: CUSTOMER_IDS.c1, name: 'Arjun Verma',   email: 'arjun.v@example.com',  phone: '8800000001' },
    { id: CUSTOMER_IDS.c2, name: 'Meera Nair',    email: 'meera.n@example.com',  phone: '8800000002' },
    { id: CUSTOMER_IDS.c3, name: 'Siddharth Rao', email: 'sid.rao@example.com',  phone: '8800000003' },
    { id: CUSTOMER_IDS.c4, name: 'Pooja Shah',    email: 'pooja.s@example.com',  phone: '8800000004' },
    { id: CUSTOMER_IDS.c5, name: 'Kiran Bose',    email: 'kiran.b@example.com',  phone: '8800000005' },
  ];

  for (const c of customerDefs) {
    await prisma.user.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id, name: c.name, email: c.email, phone: c.phone,
        password: hashedPw, role: 'customer', status: 'active', isVerified: true,
        addresses: { create: [{ addressLine: `${rand(1,999)} Residency Road, Mumbai`, type: 'home', lat: 19.076 + (Math.random()-0.5)*0.1, lng: 72.877 + (Math.random()-0.5)*0.1 }] },
        wallet: { create: { balance: rand(500, 8000) } },
      },
    });
  }
  console.log('✅ Customers upserted');

  // ─── 2. Vendors ───────────────────────────────────────────────────────────
  const vendorDefs = [
    {
      id: VENDOR_IDS.premiumWash,
      name: 'Premium Wash', email: 'premiumwash@cleclo.com', phone: '9700000001',
      businessName: 'Premium Wash Hub', city: 'Mumbai', area: 'Bandra West',
      commissionRate: 19, dailyCapacity: 200, isApproved: true, bankVerified: true,
      gstRegistered: true, gstNumber: 'GST27PREMWASH001',
      ownerName: 'Rahul Malhotra', lat: 19.0596, lng: 72.8295,
    },
    {
      id: VENDOR_IDS.quickClean,
      name: 'Quick Clean', email: 'quickclean@cleclo.com', phone: '9700000002',
      businessName: 'Quick Clean Services', city: 'Mumbai', area: 'Andheri East',
      commissionRate: 22, dailyCapacity: 150, isApproved: true, bankVerified: true,
      gstRegistered: true, gstNumber: 'GST27QKCLEAN002',
      ownerName: 'Suresh Pillai', lat: 19.1136, lng: 72.8697,
    },
    {
      id: VENDOR_IDS.freshLaundry,
      name: 'Fresh Laundry', email: 'freshlaundry@cleclo.com', phone: '9700000003',
      businessName: 'Fresh Laundry Co', city: 'Pune', area: 'Koregaon Park',
      commissionRate: 15, dailyCapacity: 180, isApproved: true, bankVerified: true,
      gstRegistered: true, gstNumber: 'GST27FRESHL003',
      ownerName: 'Amita Joshi', lat: 18.5362, lng: 73.8947,
    },
    {
      id: VENDOR_IDS.sparkleWash,
      name: 'Sparkle Wash', email: 'sparklewash@cleclo.com', phone: '9700000004',
      businessName: 'Sparkle Wash Hub', city: 'Bangalore', area: 'Indiranagar',
      commissionRate: 20, dailyCapacity: 120, isApproved: true, bankVerified: false,
      gstRegistered: false, gstNumber: null,
      ownerName: 'Vijay Kumar', lat: 12.9716, lng: 77.6099,
    },
    {
      id: VENDOR_IDS.cleanExpress,
      name: 'Clean Express', email: 'cleanexpress@cleclo.com', phone: '9700000005',
      businessName: 'Clean Express Services', city: 'Delhi', area: 'Connaught Place',
      commissionRate: 18, dailyCapacity: 160, isApproved: true, bankVerified: true,
      gstRegistered: true, gstNumber: 'GST27CLEXPR005',
      ownerName: 'Neha Kapoor', lat: 28.6315, lng: 77.2167,
    },
    {
      id: VENDOR_IDS.eliteCleaners,
      name: 'Elite Cleaners', email: 'eliteclean@cleclo.com', phone: '9700000006',
      businessName: 'Elite Dry Cleaners', city: 'Hyderabad', area: 'Jubilee Hills',
      commissionRate: 21, dailyCapacity: 100, isApproved: false, bankVerified: false,
      gstRegistered: false, gstNumber: null,
      ownerName: 'Prakash Reddy', lat: 17.4325, lng: 78.4071,
    },
  ];

  for (const v of vendorDefs) {
    // Check if email already exists (prior seed runs may have used a different id)
    const existing = await prisma.user.findUnique({ where: { email: v.email } });
    if (existing) {
      await prisma.vendorProfile.upsert({
        where: { userId: existing.id },
        update: {
          commissionRate: v.commissionRate, isApproved: v.isApproved, bankVerified: v.bankVerified, gstRegistered: v.gstRegistered,
          ownerIdProofUrl: v.isApproved ? `http://localhost:3000/test-docs/owner-id-proof.html` : null,
          businessProofUrl: v.isApproved ? `http://localhost:3000/test-docs/business-proof.html` : null,
        },
        create: {
          user: { connect: { id: existing.id } },
          businessName: v.businessName, commissionRate: v.commissionRate,
          isApproved: v.isApproved, bankVerified: v.bankVerified,
          gstRegistered: v.gstRegistered, dailyCapacity: v.dailyCapacity,
          termsAccepted: v.isApproved, slaAccepted: v.isApproved,
          ownerIdProofUrl: v.isApproved ? `http://localhost:3000/test-docs/owner-id-proof.html` : null,
          businessProofUrl: v.isApproved ? `http://localhost:3000/test-docs/business-proof.html` : null,
        },
      });
      
      // Update raw analytical fields since prisma generate is locked
      const rev = v.isApproved ? rand(150000, 800000) : 0;
      const comm = v.isApproved ? rand(20000, 150000) : 0;
      const payout = v.isApproved ? rand(0, 15000) : 0;
      const sla = v.isApproved ? rand(75, 99) : 0;
      const r = v.isApproved ? +(Math.random() * (5 - 3.5) + 3.5).toFixed(1) : 0;
      const issue = v.isApproved ? +(Math.random() * 8).toFixed(1) : 0;
      await prisma.$executeRawUnsafe(`UPDATE "VendorProfile" SET "totalRevenue" = ${rev}, "commissionEarned" = ${comm}, "payoutPending" = ${payout}, "slaScore" = ${sla}, "rating" = ${r}, "issueRate" = ${issue} WHERE "userId" = '${existing.id}'`);

      v.id = existing.id;
      continue;
    }
    await prisma.user.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id, name: v.name, email: v.email, phone: v.phone,
        password: hashedPw, role: 'vendor', status: 'active', isVerified: true,
        addresses: {
          create: [{ addressLine: `${v.businessName}, ${v.area}, ${v.city}`, type: 'work', lat: v.lat, lng: v.lng }]
        },
        vendorProfile: {
          create: {
            businessName: v.businessName,
            gstRegistered: v.gstRegistered,
            gstNumber: v.gstNumber,
            businessType: 'LLP',
            servicesOffered: 'Dry Clean, Wash Only, Iron',
            dailyCapacity: v.dailyCapacity,
            commissionRate: v.commissionRate,
            bankHolderName: v.ownerName,
            bankName: 'HDFC Bank',
            accountNumber: `${rand(1000000000, 9999999999)}`,
            ifscCode: 'HDFC0001234',
            bankVerified: v.bankVerified,
            ownerIdProofUrl: v.isApproved ? `http://localhost:3000/test-docs/owner-id-proof.html` : null,
            businessProofUrl: v.isApproved ? `http://localhost:3000/test-docs/business-proof.html` : null,
            termsAccepted: v.isApproved,
            slaAccepted: v.isApproved,
            isApproved: v.isApproved,
          }
        },
        outlets: {
          create: [{
            name: `${v.businessName} — Main Branch`,
            address: `${v.area}, ${v.city}`,
            lat: v.lat, lng: v.lng,
            operatingHours: '08:00-22:00',
          }]
        },
        wallet: { create: { balance: rand(15000, 80000) } },
      },
    });

    // Update raw analytical fields
    const rev = v.isApproved ? rand(150000, 800000) : 0;
    const comm = v.isApproved ? rand(20000, 150000) : 0;
    const payout = v.isApproved ? rand(0, 15000) : 0;
    const sla = v.isApproved ? rand(75, 99) : 0;
    const r = v.isApproved ? +(Math.random() * (5 - 3.5) + 3.5).toFixed(1) : 0;
    const issue = v.isApproved ? +(Math.random() * 8).toFixed(1) : 0;
    await prisma.$executeRawUnsafe(`UPDATE "VendorProfile" SET "totalRevenue" = ${rev}, "commissionEarned" = ${comm}, "payoutPending" = ${payout}, "slaScore" = ${sla}, "rating" = ${r}, "issueRate" = ${issue} WHERE "userId" = '${v.id}'`);

  }
  console.log('✅ Vendors upserted');

  // ─── 3. Settlements ───────────────────────────────────────────────────────
  // Re-query actual vendor IDs from DB (handles pre-existing + newly created)
  const approvedVendorEmails = vendorDefs.filter(v => v.isApproved).map(v => v.email);
  const approvedVendorRecords = await prisma.user.findMany({
    where: { email: { in: approvedVendorEmails }, role: 'vendor' },
    include: { vendorProfile: true },
  });
  const approvedVendorIds = approvedVendorRecords.map(v => v.id);

  // Delete old seeded settlements to avoid duplicates on re-run
  await prisma.vendorSettlement.deleteMany({
    where: { vendorId: { in: approvedVendorIds }, note: { startsWith: '[SEED]' } },
  });

  const settlementCycles = [
    { label: 'Week-1 Apr',  start: new Date('2026-04-01'), end: new Date('2026-04-07'),  paid: true,  paidAt: new Date('2026-04-09') },
    { label: 'Week-2 Apr',  start: new Date('2026-04-08'), end: new Date('2026-04-14'),  paid: true,  paidAt: new Date('2026-04-16') },
    { label: 'Week-3 Apr',  start: new Date('2026-04-15'), end: new Date('2026-04-21'),  paid: false, paidAt: null },
    { label: 'Week-4 Apr',  start: new Date('2026-04-22'), end: new Date('2026-04-27'),  paid: false, paidAt: null },
  ];

  for (const vendorRecord of approvedVendorRecords) {
    const rate = vendorRecord.vendorProfile?.commissionRate ?? 18;

    for (const cycle of settlementCycles) {
      const orderCount = rand(12, 35);
      const grossAmount = orderCount * rand(400, 900);
      const commissionAmount = Math.round(grossAmount * rate / 100);
      const netAmount = grossAmount - commissionAmount;

      await prisma.vendorSettlement.create({
        data: {
          vendorId: vendorRecord.id,
          grossAmount, commissionAmount, amount: netAmount, orderCount,
          penalties: rand(0, 500),
          refundAdjustments: rand(0, 300),
          taxDeducted: Math.round(commissionAmount * 0.18),
          status: cycle.paid ? 'PAID' : 'PENDING',
          note: `[SEED] ${cycle.label} payout`,
          transactionReference: cycle.paid ? `TXN-${vendorRecord.id.slice(-6).toUpperCase()}-${cycle.label.replace(/\s/g,'')}` : null,
          periodStart: cycle.start, periodEnd: cycle.end,
          processedAt: cycle.paid ? cycle.paidAt : null,
          paidAt: cycle.paid ? cycle.paidAt : null,
          settlementCycle: 'weekly', paymentMode: cycle.paid ? 'NEFT' : null,
          isAutoReconciled: true,
        },
      });
    }
  }
  console.log(`✅ Settlements created (4 cycles × ${approvedVendorRecords.length} vendors)`);

  // ─── 4. Support Tickets ───────────────────────────────────────────────────
  const customerIds = Object.values(CUSTOMER_IDS);
  const quickCleanRecord = await prisma.user.findUnique({ where: { email: 'quickclean@cleclo.com' } });
  const quickCleanId = quickCleanRecord?.id ?? customerIds[1];
  const premiumWashRecord = await prisma.user.findUnique({ where: { email: 'premiumwash@cleclo.com' } });
  const premiumWashId = premiumWashRecord?.id;

  await prisma.supportTicket.deleteMany({
    where: { subject: { startsWith: '[SEED]' } },
  });

  await prisma.supportTicket.createMany({
    data: [
      { userId: customerIds[0], subject: '[SEED] Clothes not cleaned properly', category: 'orders', message: 'My dry-cleaned suit still has visible stains after pickup.', priority: 'high', status: 'open', targetId: premiumWashId, createdAt: daysAgo(5) },
      { userId: customerIds[1], subject: '[SEED] Wrong items returned', category: 'orders', message: "I received someone else's clothes in my delivery bag.", priority: 'high', status: 'in_progress', createdAt: daysAgo(3), isEscalated: true },
      { userId: customerIds[2], subject: '[SEED] Refund not processed', category: 'payments', message: "Cancelled order 3 days ago but refund hasn't reflected.", priority: 'medium', status: 'open', createdAt: daysAgo(2) },
      { userId: quickCleanId, subject: '[SEED] Settlement amount incorrect', category: 'payments', message: 'Week-2 settlement is ₹800 less than expected. Please review.', priority: 'medium', status: 'in_progress', createdAt: daysAgo(4) },
      { userId: customerIds[3], subject: '[SEED] App crash on photo upload', category: 'technical', message: 'App crashes every time I try to attach a photo for damage claim.', priority: 'medium', status: 'open', isEscalated: true, createdAt: daysAgo(1) },
      { userId: customerIds[0], subject: '[SEED] Rider did not arrive', category: 'orders', message: 'Rider marked pickup done but never arrived at my address.', priority: 'high', status: 'resolved', resolvedAt: daysAgo(1), createdAt: daysAgo(6) },
      { userId: customerIds[4], subject: '[SEED] Loyalty points not credited', category: 'account', message: "Completed 3 orders this week but points haven't been added.", priority: 'low', status: 'open', createdAt: weekDay(0) },
    ],
  });
  console.log('✅ Support tickets created (7 tickets)');

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n🎉 Vendor seed complete!');
  console.log('   Vendors     : 6 (5 approved, 1 pending)');
  console.log('   Customers   : 5 extra seed customers');
  console.log('   Settlements : 20 records (4 cycles × 5 vendors)');
  console.log('   Tickets     : 7 support tickets');
  console.log('\n   All vendor passwords: password123');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
