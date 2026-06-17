const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.json');
const DAILY_LIMIT = 12000;

function getDb() {
  if (fs.existsSync(dbPath)) {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  }
  return {};
}

function saveDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function consumeQuota() {
  let db = getDb();
  
  const today = new Date().toISOString().split('T')[0];
  
  if (db.lastResetDate !== today) {
    db.lastResetDate = today;
    db.ai_requests_today = 0;
  }
  
  db.ai_requests_today = (db.ai_requests_today || 0) + 1;
  saveDb(db);
  
  return DAILY_LIMIT - db.ai_requests_today;
}

function getRemainingQuota() {
  let db = getDb();
  const today = new Date().toISOString().split('T')[0];
  if (db.lastResetDate !== today) {
    return DAILY_LIMIT;
  }
  return Math.max(0, DAILY_LIMIT - (db.ai_requests_today || 0));
}

module.exports = {
  consumeQuota,
  getRemainingQuota,
  DAILY_LIMIT
};
