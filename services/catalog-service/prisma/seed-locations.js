const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding locations...');

  const cities = [
    { cityCode: 'DEL', cityName: 'New Delhi', stateCode: 'DL', stateName: 'Delhi', isEnabled: true, displayOrder: 1, timezone: 'Asia/Kolkata' },
    { cityCode: 'MUM', cityName: 'Mumbai', stateCode: 'MH', stateName: 'Maharashtra', isEnabled: true, displayOrder: 2, timezone: 'Asia/Kolkata' },
    { cityCode: 'BLR', cityName: 'Bangalore', stateCode: 'KA', stateName: 'Karnataka', isEnabled: true, displayOrder: 3, timezone: 'Asia/Kolkata' },
    { cityCode: 'HYD', cityName: 'Hyderabad', stateCode: 'TG', stateName: 'Telangana', isEnabled: true, displayOrder: 4, timezone: 'Asia/Kolkata' },
    { cityCode: 'PUN', cityName: 'Pune', stateCode: 'MH', stateName: 'Maharashtra', isEnabled: true, displayOrder: 5, timezone: 'Asia/Kolkata' },
    { cityCode: 'NOI', cityName: 'Noida', stateCode: 'UP', stateName: 'Uttar Pradesh', isEnabled: true, displayOrder: 6, timezone: 'Asia/Kolkata' },
    { cityCode: 'GUR', cityName: 'Gurgaon', stateCode: 'HR', stateName: 'Haryana', isEnabled: true, displayOrder: 7, timezone: 'Asia/Kolkata' }
  ];

  for (const city of cities) {
    await prisma.cityConfig.upsert({
      where: { cityCode: city.cityCode },
      update: {
        cityName: city.cityName,
        stateCode: city.stateCode,
        stateName: city.stateName,
        isEnabled: city.isEnabled,
        displayOrder: city.displayOrder
      },
      create: city
    });
  }

  console.log('Locations seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
