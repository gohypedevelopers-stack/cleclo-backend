const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("💼 Seeding Wallets for Rider Fleet...");

  const ridersWallets = [
    {
      userId: "66666666-6666-6666-6666-666666666666",
      balance: 4000
    },
    {
      userId: "77777777-7777-7777-7777-777777777777",
      balance: 5000
    },
    {
      userId: "3b93eff4-97da-4a64-ad14-edcb818b2e3c",
      balance: 2100
    }
  ];

  for (const w of ridersWallets) {
    try {
      const user = await prisma.user.findUnique({ where: { id: w.userId } });
      if (!user) {
        console.log(`⚠️ User with ID ${w.userId} not found, skipping wallet creation.`);
        continue;
      }

      await prisma.wallet.upsert({
        where: { userId: w.userId },
        update: { balance: w.balance },
        create: {
          userId: w.userId,
          balance: w.balance
        }
      });
      console.log(`✅ Configured wallet balance of ₹${w.balance} for ${user.name}`);
    } catch (err) {
      console.error(`❌ Error seeding wallet for user ${w.userId}:`, err.message);
    }
  }

  console.log("🎉 Wallet seeding complete!");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
