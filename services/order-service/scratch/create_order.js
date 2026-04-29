require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDummyOrder() {
  try {
    const order = await prisma.order.create({
      data: {
        userId: 'test_user',
        vendorId: 'test_vendor',
        pickupTime: new Date(),
        deliveryTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        pickupAddress: 'Test Address',
        deliveryAddress: 'Test Address',
        serviceType: 'Regular',
        totalAmount: 500,
        subtotalAmount: 450,
        gstAmount: 50,
        vendorShareAmount: 400,
        platformCommissionAmount: 50,
        cityCode: 'DEL',
        areaCode: 'DEL-01',
        areaName: 'New Delhi',
        status: 'pending',
        paymentStatus: 'paid', // Mark as paid so it shows in revenue
        createdAt: new Date() // TODAY
      }
    });
    console.log('Created Order:', order.id);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createDummyOrder();
