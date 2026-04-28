const axios = require('axios');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

async function fetchUsersByIds(ids) {
    if (!ids || ids.length === 0) {
        console.log('authServiceClient: No IDs provided');
        return [];
    }
    try {
        console.log(`authServiceClient: Fetching ${ids.length} users from ${AUTH_SERVICE_URL}`);
        const response = await axios.post(`${AUTH_SERVICE_URL}/admin/users/by-ids`, { ids }, { timeout: 5000 });
        console.log(`authServiceClient: Received ${response.data?.length || 0} users`);
        return response.data;
    } catch (error) {
        console.error('authServiceClient: Failed to fetch users from Auth Service:', error.message);
        if (error.response) {
            console.error('authServiceClient: Error Response:', error.response.status, error.response.data);
        }
        return [];
    }
}

async function searchUsers(query) {
    if (!query) return [];
    try {
        console.log(`authServiceClient: Searching users for query: "${query}"`);
        const response = await axios.get(`${AUTH_SERVICE_URL}/admin/users/search`, {
            params: { search: query },
            timeout: 5000 // 5 second timeout
        });
        // Handle paginated response: { users: [], pagination: {} }
        const users = response.data?.users || (Array.isArray(response.data) ? response.data : []);
        console.log(`authServiceClient: Found ${users.length} matching users`);
        return users;
    } catch (error) {
        console.error('authServiceClient: Failed to search users from Auth Service:', error.message);
        return [];
    }
}

module.exports = {
    fetchUsersByIds,
    searchUsers
};
