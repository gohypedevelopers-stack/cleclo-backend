const jwt = require('jsonwebtoken');

const token = jwt.sign({ userId: 'test', role: 'admin' }, 'supersecret_auth_key');

fetch('http://localhost:3002/admin/content/videos', {
    headers: { 'Authorization': `Bearer ${token}` }
})
.then(res => res.json())
.then(console.log)
.catch(console.error);
