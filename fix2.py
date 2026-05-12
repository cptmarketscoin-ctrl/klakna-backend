import re

with open('C:/Users/Administrator/WorkBuddy/2026-05-05-task-1/klakna-backend/db/queries.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the upsertConfig function - find the broken run() call and fix it
old = r"""run('UPDATE config_settings SET value = ?, label = ?, value_type = ?, updated_at = datetime(\'now\') WHERE category = ? AND key = ?'"""

# Check if the old string exists
if old in content:
    # Replace with correct double-quoted JavaScript string
    new = 'run("UPDATE config_settings SET value = ?, label = ?, value_type = ?, updated_at = datetime(\'now\') WHERE category = ? AND key = ?",'
    content = content.replace(old, new)
    with open('C:/Users/Administrator/WorkBuddy/2026-05-05-task-1/klakna-backend/db/queries.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed upsertConfig function")
else:
    # Try to find and fix line by line
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'UPDATE config_settings SET' in line and 'datetime' in line:
            print(f"Found problem at line {i+1}: {line}")
            # Fix by using double quotes for JS string
            lines[i] = line.replace("run('UPDATE", 'run("UPDATE').replace("?'", '?",')
            break
    content = '\n'.join(lines)
    with open('C:/Users/Administrator/WorkBuddy/2026-05-05-task-1/klakna-backend/db/queries.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed via line-by-line approach")

# Verify
try:
    with open('C:/Users/Administrator/WorkBuddy/2026-05-05-task-1/klakna-backend/db/queries.js', 'r', encoding='utf-8') as f:
        compile(f.read(), 'queries.js', 'exec')
    print("✅ Syntax OK")
except SyntaxError as e:
    print(f"❌ Syntax error: {e}")
