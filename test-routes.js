const adminHandlers = require('./routes/admin-handlers');

console.log('Test: adminHandlers.match(GET, /admin/cs/config) = ', adminHandlers.match('GET', '/admin/cs/config') ? 'FOUND' : 'null');
console.log('Test: adminHandlers.match(GET, /admin/dashboard) = ', adminHandlers.match('GET', '/admin/dashboard') ? 'FOUND' : 'null');
