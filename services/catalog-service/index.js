const express = require('express');
const cors = require('cors');
const catalogRoutes = require('./src/routes/catalogRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.use('/catalog', catalogRoutes);
app.use('/admin', require('./src/routes/adminCatalogRoutes'));
app.use('/admin/content', require('./src/routes/adminContentRoutes'));
app.use('/admin/location', require('./src/routes/adminLocationRoutes'));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Catalog Service is running' });
});

app.listen(PORT, () => {
    console.log(`Catalog Service running on port ${PORT}`);
});
