require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrders() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' }
    });
    console.log('Total Orders in DB:', orders.length);
    orders.forEach(o => console.log(`ID: ${o.id}, CreatedAt: ${o.createdAt.toISOString()}, Status: ${o.status}`));
    
    const aprilStart = new Date(2026, 3, 1); 
    const mayStart = new Date(2026, 4, 1);
    const aprilOrders = orders.filter(o => o.createdAt >= aprilStart && o.createdAt < mayStart);
    const aprilPaidOrders = aprilOrders.filter(o => o.paymentStatus === 'paid');
    console.log('Paid Orders in April 2026:', aprilPaidOrders.length);
    const aprilPaidRevenue = aprilPaidOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    console.log('Paid Revenue in April 2026:', aprilPaidRevenue);
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const ordersToday = orders.filter(o => o.createdAt >= today);
    console.log('Orders Today:', ordersToday.length);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkOrders();
