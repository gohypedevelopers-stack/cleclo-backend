const axios = require('axios');

const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:3002';

async function fetchItemPrices(itemIds) {
    try {
        const response = await axios.post(`${CATALOG_SERVICE_URL}/catalog/items/bulk`, { itemIds });
        const items = response.data;
        
        // Map to an object for fast retrieval: { itemId: customerPrice }
        const pricingMap = {};
        for (const item of items) {
            pricingMap[item.id] = item.customerPrice;
        }
        
        return pricingMap;
    } catch (error) {
        console.error('Failed to fetch item prices from Catalog Service:', error.message);
        throw new Error('Pricing resolution failed');
    }
}

module.exports = {
    fetchItemPrices
};
