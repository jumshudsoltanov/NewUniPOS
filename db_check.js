const db = require('./electron/backend/utils/db.js');
db.query("SELECT id, uuid, start_date, total, is_synced FROM orders WHERE is_synced IN (0,2)")
  .then(r => { console.log(r[0]); process.exit(0); })
  .catch(e => { console.log(e); process.exit(1); });
