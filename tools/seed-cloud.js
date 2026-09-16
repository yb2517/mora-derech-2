// זריעת מסד הענן, משימה 13.5 בתוכנית שלב 5 חלק ב. פיתוח בלבד.
//
// המקור: CLAUDE.md סעיף 7 (נתוני ההדגמה מסומנים ב-is_demo ומוסרים
// בשלב 7), חוק ברזל 3 (רק CORE-04 נוגע באחסון, ולכן הזריעה עוברת
// בדרייבר ולא ב-SQL), הכרעה ב8 בתוכנית חלק ב (מה הזריעה כותבת).
//
// מה הסקריפט עושה: מושך את הטבלאות, ואז כותב רק מה שחסר. מפתח
// reference שכבר במסד אינו נדרס (ערך שנכתב בזמן ריצה, כמו
// enforce_gate_b, נשאר). שורת הדגמה שכבר במסד אינה מוכפלת. שורה
// בלי is_demo אינה נכתבת כלל: הסקריפט זורע נתוני הדגמה, ולא נתונים.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node tools/seed-cloud.js
//
// הערכים ממשתני הסביבה בלבד (מסמך הבנייה סעיף 3). audit_log אינה
// נזרעת: היא נכתבת בידי ה-Orchestrator בלבד (BL-09).

import { createCloudDriver, CLOUD_TABLES, PRIMARY_KEYS } from '../repository/driver-cloud.js';
import referenceFile from '../data/reference.json' with { type: 'json' };
import demo from '../data/demo/demo-data.json' with { type: 'json' };

const SEEDED_TABLES = CLOUD_TABLES.filter((name) => name !== 'reference' && name !== 'audit_log');

const driver = createCloudDriver({ env: process.env });
await driver.load();

const written = { reference: 0 };
const skipped = { reference: 0, unmarked: 0 };

const present = driver.readTable('reference') ?? {};
for (const [key, value] of Object.entries(referenceFile.values)) {
  if (Object.prototype.hasOwnProperty.call(present, key)) { skipped.reference += 1; continue; }
  driver.setRefKey(key, value);
  written.reference += 1;
}

for (const name of SEEDED_TABLES) {
  const key = PRIMARY_KEYS[name];
  const existing = new Set((driver.readTable(name) ?? []).map((row) => row[key]));
  written[name] = 0;
  skipped[name] = 0;
  for (const row of demo[name] ?? []) {
    if (row.is_demo !== true) { skipped.unmarked += 1; continue; }
    if (existing.has(row[key])) { skipped[name] += 1; continue; }
    driver.appendRow(name, row);
    written[name] += 1;
  }
}

const result = await driver.flush();
console.log('נכתב:', JSON.stringify(written));
console.log('דולג, כבר במסד:', JSON.stringify(skipped));
if (result.queued > 0 || result.failed > 0) {
  console.error(`לא הושלם: ${result.queued} ממתינות, ${result.failed} נדחו`);
  for (const failure of driver.failures()) console.error(`  ${failure.table}: ${failure.status} ${failure.detail}`);
  process.exit(1);
}
console.log('הזריעה הושלמה, והמסד קיבל את כל השורות.');
