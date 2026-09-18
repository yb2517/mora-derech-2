// Unit של קובץ הקורפוס, משימה 3 בתוכנית שלב 7.
//
// המקור: CLAUDE.md סעיף 2 (19 פריטי הקורפוס עוברים לרשומות בשלב 7),
// מפה 2.1 (שדות SITES, SOURCES, CONTENT_ITEMS ו-GEO_ANCHORS), ותוכנית
// שלב 7 הכרעות 2 (התחנות), 3 (הגבולות), 4 (אין status), 9 (audience)
// ו-11 (הקובץ כמקור הייבוא).
//
// הבדיקה שומרת על הצורה ועל העקביות הפנימית של הקובץ. את הזהות מילה
// במילה מול מסמך הקורפוס שבדרייב אין דרך לבדוק מכאן, והיא אומתה
// בכתיבת הקובץ ומדווחת בדוח השלב.
//
//   node tests/unit/corpus.test.js

import corpus from '../../data/corpus/jaffa-01.json' with { type: 'json' };
import { withinBounds } from '../../core/business-logic.js';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('קובץ הקורפוס jaffa-01');

const ITEM_FIELDS = ['item_id', 'stop_id', 'name', 'page', 'lat', 'lng', 'audience', 'word_count', 'text'];
const SITE_FIELDS = ['site_id', 'name', 'stops', 'status', 'locked_at', 'corpus_version', 'bounds'];
const SOURCE_FIELDS = ['source_id', 'name', 'file', 'publisher'];
const wordCount = (text) => String(text ?? '').trim().split(/\s+/).filter(Boolean).length;

// --- הקובץ ומקורו ---

check('הקובץ מצהיר על מסמך הקורפוס שממנו נגזר', corpus.source_document.includes('doc-build-02-corpus-jaffa.md'), true);
check('אין שדה is_demo במסלול, במקור או בפריט',
  [corpus.site, corpus.source, ...corpus.items].filter((row) => 'is_demo' in row).length, 0);

// --- המסלול (מפה 2.1, הכרעות 2 ו-3) ---

check('שדות המסלול הם שדות 2.1', Object.keys(corpus.site).sort(), [...SITE_FIELDS].sort());
check('המסלול הוא jaffa-01, במצב open, בלי נעילה ובלי גרסת קורפוס',
  [corpus.site.site_id, corpus.site.status, corpus.site.locked_at, corpus.site.corpus_version],
  ['jaffa-01', 'open', null, null]);
check('ארבע עשרה תחנות, בסדר ההליכה, בלי כפילות',
  [corpus.site.stops.length, new Set(corpus.site.stops).size, corpus.site.stops[0], corpus.site.stops.at(-1)],
  [14, 14, 'stop-01', 'stop-14']);
check('הגבולות הם מלבן חוסם עם ארבעה ערכים',
  Object.keys(corpus.site.bounds).sort(), ['max_lat', 'max_lng', 'min_lat', 'min_lng']);
check('המלבן אינו הפוך',
  corpus.site.bounds.min_lat < corpus.site.bounds.max_lat && corpus.site.bounds.min_lng < corpus.site.bounds.max_lng, true);

// --- המקור (מפה 2.1) ---

check('שדות המקור הם שדות 2.1', Object.keys(corpus.source).sort(), [...SOURCE_FIELDS].sort());
check('המקור הוא קובץ ה-PDF של הסיור', corpus.source.file, 'source-maslulimisrael-reference.pdf');

// --- 19 הפריטים ---

const items = corpus.items;
const ids = items.map((item) => item.item_id);

check('19 פריטים', items.length, 19);
check('המזהים J-01 עד J-19, ייחודיים ובסדר',
  ids, Array.from({ length: 19 }, (_, i) => `J-${String(i + 1).padStart(2, '0')}`));
check('לכל פריט בדיוק שדות 2.1 של הפריט והעוגן',
  items.filter((item) => JSON.stringify(Object.keys(item).sort()) !== JSON.stringify([...ITEM_FIELDS].sort())).map((i) => i.item_id),
  []);
check('אף פריט אינו נושא status: כולם נכנסים כ-draft דרך create_item (הכרעה 4)',
  items.filter((item) => 'status' in item).map((i) => i.item_id), []);
check('כל תחנה של פריט ברשימת התחנות של המסלול',
  items.filter((item) => !corpus.site.stops.includes(item.stop_id)).map((i) => i.item_id), []);
check('לכל תחנה במסלול פריט אחד לפחות',
  corpus.site.stops.filter((stop) => !items.some((item) => item.stop_id === stop)), []);
check('כל קואורדינטה בתוך הגבולות',
  items.filter((item) => withinBounds({ bounds: corpus.site.bounds, lat: item.lat, lng: item.lng }) !== true).map((i) => i.item_id),
  []);
check('לכל פריט טקסט שאינו ריק, שם, ועמוד שהוא מספר שלם חיובי',
  items.filter((item) => wordCount(item.text) === 0 || !item.name || !Number.isInteger(item.page) || item.page < 1).map((i) => i.item_id),
  []);
check('word_count שווה לספירת המילים בטקסט, כפי ש-BE-05 מחשב',
  items.filter((item) => item.word_count !== wordCount(item.text)).map((i) => i.item_id), []);
check('audience של כל 19 הוא כולם (הכרעה 9)',
  items.filter((item) => item.audience !== 'כולם').map((i) => i.item_id), []);
check('אין שני פריטים באותו שם', new Set(items.map((i) => i.name)).size, 19);
check('אין שני פריטים באותו עוגן', new Set(items.map((i) => `${i.lat},${i.lng}`)).size, 19);

// ההצלבה מול טבלת מסמך הקורפוס: תחנה 2 במקור נושאת ארבעה פריטים,
// ותחנה 11 שניים (תוכנית שלב 7 הכרעה 2).
check('ארבעת פריטי שער יפו חולקים תחנה אחת',
  items.filter((item) => item.stop_id === 'stop-02').map((i) => i.item_id), ['J-02', 'J-03', 'J-04', 'J-05']);
check('שני פריטי תחנה 11 במקור חולקים תחנה אחת',
  items.filter((item) => item.stop_id === 'stop-13').map((i) => i.item_id), ['J-17', 'J-18']);

report(` (${items.length} פריטים, ${corpus.site.stops.length} תחנות, ${items.reduce((sum, i) => sum + i.word_count, 0)} מילים)`);
