require('dotenv').config();
const { getDashboardOverview } = require('../src/data/adminDashboardData');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDashboard() {
  try {
    const now = new Date();
    console.log('Current Server Time:', now.toISOString());
    
    const { fetchAllAdminOrders } = require('../src/utils/orderServiceClient');
    const orders = await fetchAllAdminOrders();
    console.log('Total Orders from API:', orders.length);
    console.log('Latest Orders from API:', orders.slice(0, 5).map(o => ({id: o.id, createdAt: o.createdAt})));

    const overview = await getDashboardOverview({
      adminRole: 'super_admin',
      period: 'today'
    });

    console.log('Dashboard Overview for TODAY:');
    const ordersTodayKpi = overview.kpis.find(k => k.key === 'orders_today');
    console.log('Orders Today KPI:', ordersTodayKpi);
    
    console.log('Filters:', overview.filters);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDashboard();
