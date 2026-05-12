const fs = require('fs');

// Read queries.js
let q = fs.readFileSync('db/queries.js', 'utf8');

// Fix the upsertConfig function - replace the entire function
const upsertOld = `function upsertConfig(category, key, value, label, valueType) {
  const existing = queryOne('SELECT id FROM config_settings WHERE category = ? AND key = ?', [category, key]);
  if (existing) {
    run('UPDATE config_settings SET value = ?, label = ?, value_type = ?, updated_at = datetime(\\'now\\') WHERE category = ? AND key = ?', [value, label || key, valueType || 'text', category, key]);
    return existing.id;
  } else {
    run('INSERT INTO config_settings (category, key, value, label, value_type) VALUES (?, ?, ?, ?, ?)', [category, key, value, label || key, valueType || 'text']);
    const row = queryOne('SELECT last_insert_rowid() as id');
    return row ? row.id : 0;
  }
}`;

const upsertNew = `function upsertConfig(category, key, value, label, valueType) {
  const existing = queryOne('SELECT id FROM config_settings WHERE category = ? AND key = ?', [category, key]);
  if (existing) {
    run("UPDATE config_settings SET value = ?, label = ?, value_type = ?, updated_at = datetime('now') WHERE category = ? AND key = ?", [value, label || key, valueType || 'text', category, key]);
    return existing.id;
  } else {
    run('INSERT INTO config_settings (category, key, value, label, value_type) VALUES (?, ?, ?, ?, ?)', [category, key, value, label || key, valueType || 'text']);
    const row = queryOne('SELECT last_insert_rowid() as id');
    return row ? row.id : 0;
  }
}`;

if (q.includes(upsertOld)) {
  q = q.replace(upsertOld, upsertNew);
  fs.writeFileSync('db/queries.js', q, 'utf8');
  console.log('Fixed upsertConfig function');
} else {
  console.log('Pattern not found, trying line-by-line fix...');
  const lines = q.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('UPDATE config_settings SET') && lines[i].includes('datetime')) {
      console.log('Found at line', i + 1);
      // Fix: replace single-quoted JS string with double-quoted
      lines[i] = lines[i].replace(/^(\s*)run\(.*$/, (match) => {
        return match.replace(/^(\s*)run\(['"].*$/, '// FIXED: use double quotes for JS string');
      });
      // Just rewrite the entire line
      lines[i] = "    run(\"UPDATE config_settings SET value = ?, label = ?, value_type = ?, updated_at = datetime('now') WHERE category = ? AND key = ?\", [value, label || key, valueType || 'text', category, key]);";
      break;
    }
  }
  q = lines.join('\n');
  fs.writeFileSync('db/queries.js', q, 'utf8');
  console.log('Fixed via line replacement');
}

// Verify
try {
  require('./db/queries.js');
  console.log('✅ db/queries.js syntax OK');
} catch(e) {
  console.log('❌ Still broken:', e.message);
  process.exit(1);
}
