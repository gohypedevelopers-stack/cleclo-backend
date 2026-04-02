const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/admin', require('./src/routes/adminRoutes'));
app.use('/vendor', require('./src/routes/vendorRoutes'));
app.use('/tickets', require('./src/routes/supportRoutes'));
app.use('/addresses', require('./src/routes/addressRoutes'));
app.use('/payment-methods', require('./src/routes/paymentMethodRoutes'));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Auth Service is running' });
});

app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
