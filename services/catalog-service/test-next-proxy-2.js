const jwt = require('jsonwebtoken');

const token = jwt.sign({ userId: 'test', role: 'admin' }, 'supersecret_auth_key');

fetch('http://localhost:3000/api/admin/catalog/content/videos', {
    headers: { 'Authorization': `Bearer ${token}` }
})
.then(async res => {
    console.log(res.status, res.statusText);
    const text = await res.text();
    console.log(text.substring(0, 100));
})
.catch(console.error);
