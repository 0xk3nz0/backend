const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { uid: '12345678', username: 'mery' },
  'supersecret',   // must match your Fastify JWT secret
  { expiresIn: '1h' }
);

console.log(token);

