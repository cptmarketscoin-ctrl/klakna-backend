const fs = require('fs');
const file = 'C:/Users/Administrator/WorkBuddy/2026-05-05-task-1/klakna-backend/db/queries.js';
let c = fs.readFileSync(file, 'utf8');

// Fix the upsertConfig function - replace the broken run() call
const oldRun = "run('UPDATE config_settings SET value = ?, label = ?, value_type = ?, updated_at = datetime(\\'now\\') WHERE category = ? AND key = ?'";
const newRun = 'run("UPDATE config_settings SET value = ?, label = ?, value_type = ?, updated_at = datetime(\\'now\\') WHERE category = ? AND key = ?",';

if (c.includes(oldRun)) {
  c = c.replace(oldRun, newRun);
  fs.writeFileSync(file, c, 'utf8');
  console.log('Fixed upsertConfig function');
} else {
  // Try another pattern
  const lines = c.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('UPDATE config_settings SET') && lines[i].includes('datetime')) {
      console.log('Found problem at line', i + 1, ':', lines[i]);
      // Replace single-quoted string with double-quoted string
      lines[i] = lines[i].replace(/run\(['\"]UPDATE config_settings SET.*?\[/, 'run("UPDATE config_settings SET value = ?, label = ?, value_type = ?, updated_at = datetime(\'now\\') WHERE category = ? AND key = ?", [');
      break;
    }
  }
  c = lines.join('\n');
  fs.writeFileSync(file, c, 'utf8');
  console.log('Fixed via line-by-line approach');
}

// Verify
try {
  require(file);
  console.log('✅ Syntax OK');
} catch(e) {
  console.log('❌ Still has syntax error:', e.message);
}
