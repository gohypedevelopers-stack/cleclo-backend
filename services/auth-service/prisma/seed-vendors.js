const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  console.log('Seeding vendors...');

  const passwordHash = await bcrypt.hash('password123', 10);

  const vendors = [
    {
      name: 'Super Cleaners',
      email: 'vendor1@cleclo.com',
      phone: '+919876543210',
      password: passwordHash,
      role: 'vendor',
      status: 'active',
      vendorProfile: {
        businessName: 'Super Cleaners Inc.',
        gstRegistered: true,
        commissionRate: 15,
        isApproved: true
      }
    },
    {
      name: 'Sparkle Laundry',
      email: 'vendor2@cleclo.com',
      phone: '+919876543211',
      password: passwordHash,
      role: 'vendor',
      status: 'active',
      vendorProfile: {
        businessName: 'Sparkle Laundry & Dry Clean',
        gstRegistered: false,
        commissionRate: 18,
        isApproved: true
      }
    },
    {
      name: 'Premium Wash',
      email: 'vendor3@cleclo.com',
      phone: '+919876543212',
      password: passwordHash,
      role: 'vendor',
      status: 'active',
      vendorProfile: {
        businessName: 'Premium Wash Experts',
        gstRegistered: true,
        commissionRate: 12,
        isApproved: true
      }
    }
  ];

  for (const v of vendors) {
    const existing = await prisma.user.findUnique({ where: { email: v.email } });
    if (!existing) {
      const user = await prisma.user.create({
        data: {
          name: v.name,
          email: v.email,
          phone: v.phone,
          password: v.password,
          role: v.role,
          status: v.status,
          vendorProfile: {
            create: v.vendorProfile
          }
        }
      });
      console.log(`Created vendor ${v.name}`);
    } else {
      console.log(`Vendor ${v.name} already exists`);
    }
  }

  console.log('Vendors seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
