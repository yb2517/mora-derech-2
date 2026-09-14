// בדיקת המבנה של נקודת הכניסה, משימה 1 בתוכנית שלב 2.
//
// המקור: מסמך הבנייה גרסה 2.2 סעיף 5 (שורת /index.html), פער 21 של
// שלב 1 בהכרעת בעלת הפרויקט, ו-decision-04 ב1.
//
// זו אינה אחת משמונת מבחני המבנה. היא שומרת על התפקיד של הקובץ:
// נקודת הכניסה מרכיבה, ואינה עושה דבר מלבד זה. ברגע שהיא מתחילה
// להחזיק לוגיקה, מודול או עיצוב, הקובץ היחיד חוזר להיות מה שבנייה
// 02 הייתה, וזו בדיוק הנקודה שממנה הפרויקט יצא.
//
//   node tests/structure/entry-point.test.js

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('בדיקת נקודת הכניסה');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ENTRY = 'index.html';

check('נקודת הכניסה קיימת', existsSync(join(ROOT, ENTRY)), true);

const raw = readFileSync(join(ROOT, ENTRY), 'utf8');
const code = raw.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');

// --- 1. נקודת כניסה אחת ---

const rootPages = readdirSync(ROOT).filter((name) => name.endsWith('.html'));
check('יש קובץ HTML אחד בשורש', rootPages, [ENTRY]);

// --- 2. מרכיבה את שלוש השכבות שכבר נבנו, ולא יותר ---

const imports = [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);

check(
  'מייבאת את הדרייבר, את ה-Repository, את ה-Orchestrator ואת הכתובת',
  imports.slice().sort(),
  [
    './core/orchestrator.js',
    './repository/driver-browser.js',
    './repository/index.js',
    './screens/endpoint.js',
  ],
);

// מודול שירות, מתאם, אוטומציה, שער או כלי אינו נכנס דרך נקודת
// הכניסה: הוא נרשם ב-modules.json וה-Orchestrator מנתב אליו.
// הרשימה הזאת תגדל בשלבים 3 עד 6, והשורה הזאת היא שתיפול ראשונה
// אם מישהו ינסה לעקוף את הניתוב.
const BYPASS = ['services/', 'connectors/', 'automation/', 'gateways/', 'tools/', 'tests/'];

check(
  'אינה מייבאת מודול ישירות ואינה מייבאת עזר בדיקה',
  imports.filter((specifier) => BYPASS.some((dir) => specifier.includes(dir))).sort(),
  [],
);

// --- 3. קוראת את שלוש הטבלאות ---

const TABLES = ['registry/modules.json', 'registry/allow-list.json', 'data/reference.json'];

check(
  'קוראת את שלוש טבלאות הנתונים',
  TABLES.filter((path) => !code.includes(path)),
  [],
);

// --- 4. משתמשת בערכת העיצוב ואינה מגדירה עיצוב משלה ---

check('טוענת את קובץ הערכה', raw.includes('design/tokens.css'), true);
check('טוענת את רכיבי הערכה', raw.includes('design/components/'), true);

// <style> ו-style= הם שני המסלולים שדרכם עיצוב נכנס לקובץ ועוקף
// את DESIGN-01. שניהם נבדקים על הטקסט הגולמי, מפני שהערה שמכילה
// אותם היא ממילא כתיבה שאין לה סיבה.
check('אין בה בלוק עיצוב משלה', /<style[\s>]/.test(raw), false);
check('אין בה עיצוב על תגית', /style\s*=\s*["']/.test(raw), false);

// --- 5. אינה מחזיקה לוגיקה עסקית ---

// שמות החוקים העסקיים ומצבי הפריט. נקודת הכניסה מרכיבה, ולכן אין
// לה סיבה להזכיר מצב, מעבר או חוק. הם נכנסים ב-core/business-logic.js
// בשלב 3.
const BUSINESS = ['approved', 'rejected', 'pending', 'draft', 'locked', 'BL-'];

check(
  'אינה מזכירה מצב פריט או חוק עסקי',
  BUSINESS.filter((token) => code.includes(token)).sort(),
  [],
);

report(` (${imports.length} ייבואים, ${TABLES.length} טבלאות)`);
