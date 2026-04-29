const { PrismaClient } = require('@prisma/client');

const prisma = global.__prisma || new PrismaClient({
  datasources: {
    db: {
      url: (process.env.DATABASE_URL || '').includes('?') 
        ? process.env.DATABASE_URL + '&connection_limit=20' 
        : (process.env.DATABASE_URL || '') + '?connection_limit=20'
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

module.exports = prisma;
