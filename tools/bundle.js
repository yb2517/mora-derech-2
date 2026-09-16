// סקריפט האיחוד לקובץ יחיד. משימה 9 בתוכנית שלב 2, הכרעה ד
// באישור בעלת הפרויקט 14.09.2026.
//
// מה הוא: אריזה. decision-04 ב1 קובעת שיעד ההרצה של שלבים 1 עד 4
// הוא "קובץ יחיד בלחיצה כפולה", ודפדפן שנפתח מ-file:// חוסם גם
// טעינת מודולים וגם fetch. לכן המסירה היא קובץ אחד שבתוכו הכול.
//
// **מה הוא אינו: הוא אינו הארכיטקטורה.** decision-04 א2 קובעת
// במפורש שהקובץ היחיד הוא אריזה ולא מבנה. הפיתוח והבדיקות ממשיכים
// לרוץ על הקבצים הנפרדים ב-Localhost, וזה מה שמבחני המבנה בודקים.
// הקובץ הזה אינו מקור אמת שני: הוא קורא את נקודת הכניסה, הולך אחרי
// גרף הייבוא שלה, וקורא את עמודת ה-handler מטבלת המודולים. מודול
// חדש נכנס לאריזה מפני שהוא בנתונים או בגרף, ולא מפני ששורה כאן
// מזכירה אותו.
//
// **מה הוא אינו עושה גם כן: הוא אינו משנה לוגיקה.** כל שינוי שהוא
// מבצע הוא תרגום של שלוש צורות שפה: ייבוא, ייצוא, וייבוא דינמי.
// צורה שאינה מוכרת לו עוצרת אותו בזריקה, ואינה עוברת בשקט.
//
//   node tools/bundle.js [נתיב הפלט]
//
// ברירת המחדל: dist/mora-derech-2.html

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENTRY_HTML = 'index.html';
const DEFAULT_OUT = join('dist', 'mora-derech-2.html');

// שלוש טבלאות הנתונים, בדיוק כפי ש-TABLE_SOURCES בנקודת הכניסה
// מונה אותן. הן נכנסות לקובץ כבלוקים, ונקודת הכניסה כבר מעדיפה
// בלוק על פני fetch.
const TABLES = {
  modules: 'registry/modules.json',
  allow_list: 'registry/allow-list.json',
  reference: 'data/reference.json',
};

const read = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8');
const exists = (relativePath) => existsSync(join(ROOT, relativePath));

/** נתיב יחסי לשורש המאגר, תמיד עם לוכסן קדימה. */
function repoPath(fromFile, specifier) {
  const absolute = resolve(dirname(join(ROOT, fromFile)), specifier);
  return relative(ROOT, absolute).split('\\').join('/');
}

// --- עיצוב ---

/** מרכיב קובץ CSS ואת כל מה שהוא מייבא, לפי הסדר. */
function inlineCss(path, seen = new Set()) {
  if (seen.has(path)) return '';
  seen.add(path);

  const text = read(path);
  const parts = [];
  const body = text.replace(/@import\s+["']([^"']+)["']\s*;/g, (match, specifier) => {
    parts.push(inlineCss(repoPath(path, specifier), seen));
    return '';
  });

  // url() היה שובר קובץ יחיד: הנתיב היחסי אינו קיים אחרי האריזה.
  if (/url\(/.test(body)) {
    throw new Error(`${path} מכיל url(), ואין לו משמעות בקובץ יחיד`);
  }

  parts.push(`/* ${path} */\n${body.trim()}`);
  return parts.join('\n\n');
}

// --- מודולים ---

// שלוש צורות הייבוא שהקוד משתמש בהן, ותו לא. צורה רביעית תעצור
// את הסקריפט למטה, בבדיקת השארית.
const IMPORT_FORMS = [
  // import ברירת מחדל ושמות יחד
  {
    pattern: /^[ \t]*import\s+(\w+)\s*,\s*\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]\s*;/gm,
    emit: (name, names, specifier, id) => `const ${id} = __require(${JSON.stringify(specifier)});`
      + ` const ${name} = ${id}.default;`
      + ` const {${destructure(names)}} = ${id};`,
  },
  // import של שמות
  {
    pattern: /^[ \t]*import\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]\s*;/gm,
    emit: (names, specifier) => `const {${destructure(names)}} = __require(${JSON.stringify(specifier)});`,
  },
  // import של ברירת מחדל, ובכלל זה ייבוא JSON עם with { type: 'json' }
  {
    pattern: /^[ \t]*import\s+(\w+)\s+from\s+['"]([^'"]+)['"](\s+with\s+\{[^}]*\})?\s*;/gm,
    emit: (name, specifier) => `const ${name} = __require(${JSON.stringify(specifier)}).default;`,
  },
];

/** "a, b as c" נעשה "a, b: c". */
function destructure(names) {
  return names
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map((entry) => {
      const parts = entry.split(/\s+as\s+/);
      return parts.length === 2 ? `${parts[0]}: ${parts[1]}` : entry;
    })
    .join(', ');
}

/**
 * מתרגם מודול אחד: ייבוא לקריאה לטוען, ייצוא להשמה, וייבוא דינמי
 * לטוען האסינכרוני. מחזיר את הגוף ואת רשימת התלויות.
 */
function transform(path, source) {
  const dependencies = [];
  let body = source;
  let counter = 0;

  for (const form of IMPORT_FORMS) {
    body = body.replace(form.pattern, (...match) => {
      const groups = match.slice(1, -2).filter((value) => value !== undefined);
      // המפרט הוא תמיד הקבוצה שנראית כמו נתיב.
      const specifier = groups.find((value) => /^[./]/.test(value));
      const target = repoPath(path, specifier);
      dependencies.push(target);
      counter += 1;
      const args = groups.map((value) => (value === specifier ? target : value));
      return form.emit(...args, `__m${counter}`);
    });
  }

  // ייבוא דינמי. המפרט מחושב בזמן ריצה, ולכן הטוען מקבל אותו כמות
  // שהוא ומחפש אותו במרשם. מודול שאינו באריזה נופל בדיוק כפי
  // שמודול שאינו קיים נופל בפיתוח, ונקודת הכניסה כבר תופסת את זה.
  body = body.replace(/(^|[^.\w$])import\s*\(/g, '$1__import(');

  // ייצוא. הצבת הערכים בסוף הגוף, מפני שהצהרות פונקציה מורמות
  // וקבועים כבר אותחלו עד שם.
  const exported = [];
  body = body.replace(
    /^export\s+default\s+(async\s+)?function\s+(\w+)/gm,
    (match, isAsync, name) => {
      exported.push(['default', name]);
      return `${isAsync ?? ''}function ${name}`;
    },
  );
  body = body.replace(
    /^export\s+(?:(async\s+)?function|const|let|class)\s+(\w+)/gm,
    (match, isAsync, name) => {
      exported.push([name, name]);
      return match.replace(/^export\s+/, '');
    },
  );

  // השארית: מה שלא זוהה אינו עובר בשקט.
  //
  // הדרישה לרווח אחרי מילת המפתח אינה קוסמטית: `export` הוא גם שם
  // פעולה של BE-07 בטבלת ההדגמה, ושם הוא מופיע כ-`export:`. הצהרה
  // אמיתית נושאת תמיד רווח אחרי המילה.
  const leftover = body.split('\n').find((line) => /^\s*(import|export)(\s|$)/.test(line));
  if (leftover) {
    throw new Error(`${path}: צורת ייבוא או ייצוא שאינה מוכרת לסקריפט: ${leftover.trim()}`);
  }

  const tail = exported
    .map(([name, local]) => `  __exports[${JSON.stringify(name)}] = ${local};`)
    .join('\n');

  return { body, tail, dependencies };
}

/** מודול JSON: הערך כולו הוא ייצוא ברירת המחדל. */
function jsonModule(path) {
  return {
    body: `  const __data = ${read(path)};`,
    tail: '  __exports.default = __data;',
    dependencies: [],
  };
}

/** אוסף את סגור הגרף מנקודת התחלה אחת או יותר. */
function collect(entries) {
  const modules = new Map();
  const queue = [...entries];

  while (queue.length > 0) {
    const path = queue.shift();
    if (modules.has(path)) continue;
    if (!exists(path)) throw new Error(`המודול ${path} אינו קיים במאגר`);

    const module = path.endsWith('.json')
      ? jsonModule(path)
      : transform(path, read(path));

    modules.set(path, module);
    queue.push(...module.dependencies);
  }

  return modules;
}

/**
 * סגור שאינו שלם הוא התקלה השקטה של אריזה: הקובץ נוצר, נפתח, ונופל
 * רק כשמישהו לוחץ על הכפתור שמגיע למודול החסר. לכן הוא נבדק כאן
 * ובשמו, ואינו מתגלה כתקלה אקראית מאוחר יותר.
 */
function assertClosed(modules) {
  const orphans = [...modules.entries()].flatMap(([path, module]) => module.dependencies
    .filter((dependency) => !modules.has(dependency))
    .map((dependency) => `${path} -> ${dependency}`));

  if (orphans.length > 0) {
    throw new Error(`הסגור אינו שלם, מודול חסר באריזה: ${orphans.join(', ')}`);
  }
}

/** מעגל בגרף היה שובר את הטוען, מפני שהייצוא מוצב בסוף הגוף. */
function assertAcyclic(modules) {
  const open = new Set();
  const done = new Set();

  const walk = (path, trail) => {
    if (done.has(path)) return;
    if (open.has(path)) {
      throw new Error(`מעגל בגרף הייבוא: ${[...trail, path].join(' -> ')}`);
    }
    open.add(path);
    for (const next of modules.get(path).dependencies) walk(next, [...trail, path]);
    open.delete(path);
    done.add(path);
  };

  for (const path of modules.keys()) walk(path, []);
}

// --- ההרכבה ---

/** הטוען. מרשם לפי נתיב, והערכה עצלה עם מטמון. */
const LOADER = `
  // הטוען של האריזה. אינו חלק מהמערכת: הוא מחליף את מנגנון
  // המודולים של הדפדפן, שאינו זמין כשהקובץ נפתח מ-file://.
  const __registry = {};
  const __cache = {};

  function __normalize(specifier) {
    return String(specifier).replace(/^\\.\\//, '');
  }

  function __require(path) {
    const id = __normalize(path);
    if (id in __cache) return __cache[id];
    const factory = __registry[id];
    if (!factory) throw new Error('המודול ' + id + ' אינו באריזה');
    const __exports = {};
    __cache[id] = __exports;
    factory(__exports);
    return __exports;
  }

  function __import(specifier) {
    return Promise.resolve().then(() => __require(specifier));
  }
`;

function factoryFor(path, module) {
  return `__registry[${JSON.stringify(path)}] = (__exports) => {\n`
    + `${module.body.trimEnd()}\n`
    + (module.tail ? `${module.tail}\n` : '')
    + '};';
}

/** בלוק נתונים בגוף הקובץ, בצורה שנקודת הכניסה כבר מחפשת. */
function tableBlock(name, path) {
  // סגירת תגית בתוך טקסט JSON הייתה סוגרת את הבלוק מוקדם.
  const text = read(path).replace(/<\//g, '<\\/');
  return `<script type="application/json" data-table="${name}">\n${text.trim()}\n</script>`;
}

function build() {
  const html = read(ENTRY_HTML);

  // 1. גוף הסקריפט של נקודת הכניסה.
  const scriptMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('לא נמצא סקריפט המודול בנקודת הכניסה');
  const entry = transform(ENTRY_HTML, scriptMatch[1]);

  // 2. סגור הגרף: מה שנקודת הכניסה מייבאת, ועוד כל handler שרשום
  //    בטבלת המודולים וקובצו קיים. עזרי בדיקה אינם נארזים, בדיוק
  //    כפי שנקודת הכניסה אינה טוענת אותם.
  //    מודול שנטען בהרכבה ואינו מנותב (עמודת file, הכרעה 6 בתוכנית
  //    שלב 5) נארז מאותה סיבה: הוא בנתונים, ולא בגרף הייבוא.
  const modulesTable = JSON.parse(read(TABLES.modules));
  const handlers = modulesTable.modules
    .flatMap((row) => [row.handler, row.file])
    .filter((handler) => typeof handler === 'string' && handler !== '')
    .filter((handler) => !handler.startsWith('tests/'))
    .filter((handler) => exists(handler));

  const modules = collect([...entry.dependencies, ...handlers]);
  assertClosed(modules);
  assertAcyclic(modules);

  // 3. העיצוב, במקום תגיות ה-link.
  const styles = [];
  let head = html.replace(/\s*<link rel="stylesheet" href="([^"]+)">/g, (match, href) => {
    styles.push(inlineCss(repoPath(ENTRY_HTML, href)));
    return '';
  });
  if (styles.length === 0) throw new Error('לא נמצאה תגית עיצוב בנקודת הכניסה');

  head = head.replace('</head>', `<style>\n${styles.join('\n\n')}\n</style>\n</head>`);

  // 4. הסקריפט: הטוען, המרשם, ואז גוף נקודת הכניסה כמות שהוא.
  const registry = [...modules.entries()]
    .map(([path, module]) => factoryFor(path, module))
    .join('\n\n');

  const script = `<script type="module">\n${LOADER}\n${registry}\n\n// --- נקודת הכניסה ---\n${entry.body.trimEnd()}\n</script>`;

  const tables = Object.entries(TABLES)
    .map(([name, path]) => tableBlock(name, path))
    .join('\n');

  const out = head.replace(
    /<script type="module">[\s\S]*?<\/script>/,
    `${tables}\n\n${script}`,
  );

  return { out, modules, styles, handlers };
}

// --- ההרצה ---

const target = process.argv[2] ?? DEFAULT_OUT;
const { out, modules, handlers } = build();

// resolve ולא join: נתיב מוחלט שנמסר בשורת הפקודה נשאר כמות שהוא.
const absolute = resolve(ROOT, target);
mkdirSync(dirname(absolute), { recursive: true });
writeFileSync(absolute, out, 'utf8');

// הבדיקה של הסקריפט על עצמו: קובץ שנשארה בו הפניה החוצה אינו
// קובץ יחיד, והוא היה נפתח ריק בלחיצה כפולה.
const outward = [
  [/<link\b/, 'תגית link'],
  [/<script[^>]*\ssrc=/, 'סקריפט חיצוני'],
  [/^\s*import\s/m, 'הצהרת import'],
  [/\bfrom\s+['"]\.\.?\//m, 'ייבוא יחסי'],
].filter(([pattern]) => pattern.test(out));

if (outward.length > 0) {
  throw new Error(`הקובץ שנוצר עדיין מפנה החוצה: ${outward.map(([, what]) => what).join(', ')}`);
}

const size = (Buffer.byteLength(out, 'utf8') / 1024).toFixed(0);
console.log(`נארז: ${target}`);
console.log(`  ${modules.size} מודולים, ${Object.keys(TABLES).length} טבלאות נתונים, ${size}KB`);
if (handlers.length > 0) console.log(`  handlers מטבלת המודולים: ${handlers.join(', ')}`);
