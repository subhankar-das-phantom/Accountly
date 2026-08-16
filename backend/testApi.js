const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign({ id: '64f0b2f4a1c5d9e8b7a6c5d4' }, process.env.JWT_SECRET);

fetch('http://localhost:5000/api/users/me', {
  headers: { Authorization: `Bearer ${token}` }
}).then(async res => {
  console.log('STATUS:', res.status);
  console.log('DATA:', await res.json());
}).catch(err => {
  console.error('ERROR', err);
});
