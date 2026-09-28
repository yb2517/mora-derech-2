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

// --- 3ב. מצב בדיקה בכתובת (מפה 4.3, פערים 82 ו-83; תוכנית שלב 8 משימה 7) ---

check('קוראת את הפרמטר mode, ומצב בדיקה הוא הערך test בלבד',
  /searchParams\.get\('mode'\)\s*===\s*'test'/.test(code), true);
check('מכירה את קובץ שורות הבדיקה', code.includes('registry/allow-list-test.json'), true);
check('וטוענת אותו רק במצב בדיקה',
  /TEST_MODE\s*\?[^;]*loadTable\('allow_list_test'\)/.test(code), true);
check('ואינה טוענת אותו בשום מקום אחר',
  (code.match(/loadTable\('allow_list_test'\)/g) ?? []).length, 1);
check('בלי מצב בדיקה רשימת המותר היא קובץ הייצור כמות שהוא',
  /:\s*production;/.test(code), true);
check('פאנל הסימולטור: בהרכבת הפיתוח, או במצב בדיקה',
  /simulator && \(development \|\| TEST_MODE\) && traveler/.test(code), true);
check('שם הקול מגיע לפאנל רק במצב בדיקה', /voice:\s*TEST_MODE \? voice : null/.test(code), true);
check('ומסך המטייל מקבל את מצב הבדיקה, ללחצן הדילוג (פער 83)', /equipment:\s*\{[^}]*testMode:\s*TEST_MODE/.test(code), true);

// --- 3ג. מתג הערכה (מפה 4.3 ו-3.3 שורת DESIGN-01, פער 92; תוכנית שלב 9 משימה 2) ---

check('שלוש הערכות: בהירה, כהה וראיית לילה',
  /THEMES = \[\['light', [^\]]+\], \['dark', [^\]]+\], \['night', [^\]]+\]\]/.test(code), true);
check('המתג משנה רק את data-theme בשורש הדף',
  (code.match(/document\.documentElement\.dataset\.theme\s*=/g) ?? []).length, 1);
check('הערכה הראשונה לפי הגדרת המכשיר, בהירה או כהה',
  /prefers-color-scheme: dark[\s\S]*?\?\s*'dark'\s*:\s*'light'/.test(code), true);
check('רק שורש הדף נושא data-theme: האפשרויות נושאות data-theme-option',
  /option\.dataset\.theme\s*=/.test(code) || /setAttribute\('data-theme'/.test(code), false);
check('הבחירה אינה נשמרת: אין אחסון בנקודת הכניסה (חוק ברזל 3)',
  /localStorage|sessionStorage|indexedDB|document\.cookie/.test(code), false);
check('המתג אינו שולח מעטפה',
  /function themeSwitch\(\)[\s\S]*?return group;/.exec(code)?.[0].includes('send(') ?? null, false);
check('במסך המטייל המתג נעלם בתחילת הסשן ובחידוש אחרי חסימה',
  /on\('session:start', \(\) => \{ themeControl\.hidden = true; \}\)/.test(code)
    && /on\('battery:resume', \(\) => \{ themeControl\.hidden = true; \}\)/.test(code), true);
check('וחוזר בסיום הסשן ובחסימת הסוללה, שסוגרת אותו',
  /on\('session:end', \(\) => \{ themeControl\.hidden = false; \}\)/.test(code)
    && /on\('battery:block', \(\) => \{ themeControl\.hidden = false; \}\)/.test(code), true);

// --- 3ג2. צבע סרגל הדפדפן (מפה 4.3, פער 98) ---

check('כל החלת ערכה צובעת גם את סרגל הדפדפן',
  /function setTheme\(theme\) \{[^}]*dataset\.theme = theme;\s*paintBrowserBar\(\);/.test(code), true);
check('הצבע נקרא מ---canvas של הערכה הפעילה',
  /getComputedStyle[^;]*getPropertyValue\('--canvas'\)/.test(code), true);
check('ונכתב לתגית theme-color',
  /meta\[name="theme-color"\]/.test(code) && /setAttribute\('content', canvas\)/.test(code), true);
check('אין ערך צבע בנקודת הכניסה: הצבע בא מ-tokens.css בלבד',
  /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(code), false);

// --- 3ד. מחוון ההתקדמות: ההרכבה מוסרת את התחנות ואת ההגעה (מפה 4.1, פער 93) ---

check('ההרכבה מוסרת למסך המטייל את רשימת תחנות המסלול',
  /stops:\s*\(siteId\)\s*=>\s*repository\.getSite\(siteId\)\?\.stops/.test(code), true);
check('ואת התחנה ש-AUTO-01 קבע, אחרי כל דגימה',
  /onSample:[\s\S]*?geofence\?\.current\(\)\.stop_id[\s\S]*?traveler\?\.reachStop\(stopId\)/.test(code), true);
check('גם בדגימות המכשיר וגם בדגימות הסימולטור',
  /\(simulatorOn\(\) \? simulator : location\)\.start\(withProgress\(args\)\)/.test(code), true);

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
