// Vercel runs this for every /api/... request (see vercel.json).
// It is exactly the same code as `node server.js` – the request handler is shared.
module.exports = require('../server');
