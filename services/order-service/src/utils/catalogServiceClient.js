const axios = require('axios');

const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:3002';

async function fetchItemPrices(itemIds, cityCode = null, vendorId = null) {
    try {
        const response = await axios.post(`${CATALOG_SERVICE_URL}/catalog/items/bulk`, { 
            itemIds,
            cityCode,
            vendorId
        });
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

async function resolveCatalogPricing({ items, cityCode = null, vendorId = null, serviceMultiplier = 1 }) {
    try {
        const response = await axios.post(`${CATALOG_SERVICE_URL}/catalog/pricing/resolve`, {
            items,
            cityCode,
            vendorId,
            serviceMultiplier
        });
        return response.data;
    } catch (error) {
        console.error('Failed to resolve pricing from Catalog Service:', error.response?.data || error.message);
        throw new Error('Pricing resolution failed');
    }
}

async function validateLocationAndSlot(params) {
    try {
        const response = await axios.post(`${CATALOG_SERVICE_URL}/catalog/locations/validate`, params);
        return response.data;
    } catch (error) {
        console.error('Failed to validate location from Catalog Service:', error.response?.data || error.message);
        return { valid: false, message: 'Validation failed' };
    }
}

module.exports = {
    fetchItemPrices,
    resolveCatalogPricing,
    validateLocationAndSlot
};
