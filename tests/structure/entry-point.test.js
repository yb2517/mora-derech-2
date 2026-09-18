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
  'מייבאת את שני הדרייברים, את ה-Repository, את ה-Orchestrator, את הכתובת, את המסכים ואת שלושת המתאמים',
  imports.slice().sort(),
  [
    './connectors/location.js',
    './connectors/stt.js',
    './connectors/tts.js',
    './core/orchestrator.js',
    './repository/driver-browser.js',
    './repository/driver-cloud.js',
    './repository/index.js',
    './screens/admin/index.js',
    './screens/endpoint.js',
    './screens/traveler/index.js',
    './screens/veto/index.js',
  ],
);

// מודול שירות, מתאם, אוטומציה, שער או כלי אינו נכנס דרך נקודת
// הכניסה: הוא נרשם ב-modules.json וה-Orchestrator מנתב אליו.
// הרשימה הזאת תגדל בשלבים 3 עד 6, והשורה הזאת היא שתיפול ראשונה
// אם מישהו ינסה לעקוף את הניתוב.
const BYPASS = ['services/', 'automation/', 'gateways/', 'tests/', 'tools/'];

check(
  'אינה מייבאת מודול שירות ואינה מייבאת עזר בדיקה',
  imports.filter((specifier) => BYPASS.some((dir) => specifier.includes(dir))).sort(),
  [],
);

// /connectors/ ירדה מהרשימה בהכרעת פער B-34 (מפה 3.8, סעיף 4.1):
// מתאם אינו פונה ואינו נמען, אלא ציוד שמוזרק למודול שמשתמש בו,
// כפי שדרייבר האחסון מוזרק ל-CORE-04. מי שמזריק הוא מי שמרכיב,
// ולכן נקודת הכניסה רשאית לייבא אותם, **ורק אותם**.
//
// ההגנה לא נחלשה, היא הועברה: מבחן מבנה 08 ממשיך לאסור על מודול
// לייבא מתאם, ולכן AUTO-01 אינו יכול לייבא את CONN-03 בעצמו. אם
// ההזרקה תיעקף, הבדיקה ההיא תיפול.
const MODULE_DIRS_ALLOWED_AT_COMPOSITION = ['connectors/'];
const moduleImports = imports.filter((specifier) => /(services|connectors|automation|gateways)\//.test(specifier));

check(
  'מודול היחיד שהיא רשאית לייבא הוא מתאם',
  moduleImports.filter(
    (specifier) => !MODULE_DIRS_ALLOWED_AT_COMPOSITION.some((dir) => specifier.includes(dir)),
  ).sort(),
  [],
);

// עד שלב 7 היה כאן חריג אחד, מוצהר: מודול ההדגמה של משימה 4 בשלב 2
// עמד במקום מודולי השירות כל עוד לא היו קיימים. הוא הוסר עם נתוני
// ההדגמה (מסמך הבנייה סעיף 7), ומשלב 7 /tools/ הוא פיתוח בלבד
// שנטען מטבלת המודולים (הסימולטור, עמודת file) ולא בייבוא.
check(
  'אינה מייבאת דבר מ-tools',
  imports.filter((specifier) => specifier.includes('tools/')).sort(),
  [],
);

// --- 3. קוראת את שלוש הטבלאות ---

const TABLES = ['registry/modules.json', 'registry/allow-list.json', 'data/reference.json'];

check(
  'קוראת את שלוש טבלאות הנתונים',
  TABLES.filter((path) => !code.includes(path)),
  [],
);

// --- 3א. בוחרת מסך לפי הפרמטר screen, ומשווה אותו לנתונים (מפה 4.3, פער 63) ---

check('קוראת את הפרמטר screen מהכתובת', code.includes("searchParams.get('screen')"), true);
// השם מושווה לשם הפונה שבטבלת המודולים, ולא לשם כתוב בקוד: מבחן
// מבנה 06 אוסר שם פונה בקוד, והבדיקה כאן מוודאת שהבחירה עוברת
// דרך callerOf ולא דרך מחרוזת.
check('הבחירה עוברת דרך שם הפונה מהנתונים', /callerOf\(id\) === wanted/.test(code), true);
check('בלי פרמטר: כל המסכים', /development\s*\?\s*SCREENS/.test(code), true);

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
