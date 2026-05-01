require('dotenv').config();
const express = require('express');
const cors = require('cors');
const orderRoutes = require('./src/routes/orderRoutes');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
// Serve uploaded images static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/orders', orderRoutes);

// Internal service-to-service route (no JWT required)
// Used by auth-service dashboard aggregation
app.get('/internal/orders', async (req, res) => {
    try {
        const { userIds } = req.query;
        const prisma = require('./src/utils/prisma');
        
        const where = {};
        if (userIds) {
            const idList = Array.isArray(userIds) ? userIds : String(userIds).split(',');
            where.OR = [
                { userId: { in: idList } },
                { vendorId: { in: idList } },
                { riderId: { in: idList } }
            ];
        }

        const orders = await prisma.order.findMany({
            where,
            include: {
                items: {
                    include: { images: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        console.error('Internal orders fetch error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.use('/admin/orders', require('./src/routes/adminOrderRoutes'));
app.use('/vendor/orders', require('./src/routes/vendorOrderRoutes'));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Order Service is running' });
});

app.listen(PORT, () => {
    console.log(`Order Service running on port ${PORT}`);
});
