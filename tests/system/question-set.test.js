// System: מערך השאלות על הקורפוס. משימה 4 בתוכנית שלב 8.
//
// המקור: מפה 7, שורת שלב 8, ו-CLAUDE.md סעיף 6 (בדיקת הקבלה של שלב
// 8); הכרעה 2 בתוכנית שלב 8 (הרף, כמו בבנייה 01); מערך השאלות שאושר
// 27.09.2026, tests/helpers/question-set.json; ו-usecase-f-05, הזרימה
// הראשית.
//
// השאלות רצות מקצה לקצה דרך ה-Orchestrator, מול BE-04 האמיתי, על 19
// הטקסטים של הקורפוס כפריטים מאושרים תחת הסכם בתוקף. הרף:
//   לפחות 18 מ-20 שאלות עם תשובה עונות מהפריט המצופה;
//   לכל היותר 2 מ-10 שאלות זרות עוברות את הסף.
// המשפט המצופה אינו ברף. הוא נמדד ומדווח. המגבלות הידועות (הכרעה
// פתוחה 9) אינן ברף, ומדווחות.
//
//   node tests/system/question-set.test.js

import { createChecker } from '../helpers/assert.js';
import { corpusItems, corpusSentence } from '../helpers/corpus-pool.js';

const { check, report } = createChecker('System: מערך השאלות');

const { createBrowserDriver } = await import('../../repository/driver-browser.js');
const { createRepository } = await import('../../repository/index.js');
const { createOrchestrator } = await import('../../core/orchestrator.js');
const { createEndpoint } = await import('../../screens/endpoint.js');
const { create: createRetrieval } = await import('../../services/retrieval.js');

const modulesFile = (await import('../../registry/modules.json', { with: { type: 'json' } })).default;
const allowFile = (await import('../../registry/allow-list.json', { with: { type: 'json' } })).default;
const referenceFile = (await import('../../data/reference.json', { with: { type: 'json' } })).default;
const questionSet = (await import('../helpers/question-set.json', { with: { type: 'json' } })).default;

const ANSWERABLE_BAR = 18;
const FOREIGN_BAR = 2;

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

const items = corpusItems({ site_id: 'site-qs', source_id: 'src-qs' });

const repository = createRepository(createBrowserDriver({
  storage: memoryStorage(),
  seed: {
    modules: modulesFile,
    allow_list: allowFile,
    reference: referenceFile.values,
    sites: [{ site_id: 'site-qs', name: 'מסלול', stops: [...new Set(items.map((item) => item.stop_id))] }],
    sources: [{ source_id: 'src-qs', name: 'מקור' }],
    rights_mou: [{
      mou_id: 'mou-qs', institute_id: 'inst-qs', scope: ['src-qs'],
      signed_at: '2026-09-01T00:00:00.000Z', valid_until: '2099-01-01T00:00:00.000Z',
    }],
    content_items: items,
  },
}));

const orchestrator = createOrchestrator({
  repository,
  handlers: { 'BE-04': createRetrieval({ repository }) },
});
const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });
const retrieve = (question) => send({
  from: 'module-dialogue', module: 'BE-04', action: 'retrieve', payload: { question, site_id: 'site-qs' },
});

// --- המערך עצמו: אושר, וכל הפניה קיימת בקורפוס (בדיקת הקבלה של משימה 3) ---

check('המערך אושר', questionSet.status.startsWith('אושר'), true);
check('20 שאלות עם תשובה', questionSet.answerable.length, 20);
check('10 שאלות זרות', questionSet.foreign.length, 10);
check('כל שאלה עם תשובה מפנה לפריט ולמשפט שקיימים בקורפוס, כלשונו',
  [...questionSet.answerable, ...questionSet.known_limitations]
    .filter((q) => corpusSentence(q.item_id, q.sentence_index) !== q.sentence)
    .map((q) => q.id),
  []);

// --- בדיקת הקבלה של שלב 8: "מתי נבנה שער יפו?" ---

{
  const response = await retrieve('מתי נבנה שער יפו?');
  check('"מתי נבנה שער יפו?" נענית', response.data.is_fallback, false);
  check('מ-J-02', response.data.source_item, 'J-02');
  check('במשפט 1538', response.data.answer, corpusSentence('J-02', 11));
}

// --- השאלות עם תשובה ---

const answered = [];
for (const q of questionSet.answerable) {
  const response = await retrieve(q.question);
  const itemHit = response.ok && response.data.is_fallback === false && response.data.source_item === q.item_id;
  const sentenceHit = itemHit && response.data.answer.includes(q.sentence);
  answered.push({ id: q.id, itemHit, sentenceHit, got: response.data?.source_item ?? null });
}

const itemHits = answered.filter((row) => row.itemHit).length;
const sentenceHits = answered.filter((row) => row.sentenceHit).length;
const itemMisses = answered.filter((row) => !row.itemHit).map((row) => `${row.id}:${row.got}`);

check(`לפחות ${ANSWERABLE_BAR} מ-20 עונות מהפריט המצופה`, itemHits >= ANSWERABLE_BAR, true);

// --- השאלות הזרות ---

const passed = [];
for (const q of questionSet.foreign) {
  const response = await retrieve(q.question);
  if (response.ok && response.data.is_fallback === false) passed.push(`${q.id}:${response.data.source_item}`);
}

check(`לכל היותר ${FOREIGN_BAR} מ-10 זרות עוברות את הסף`, passed.length <= FOREIGN_BAR, true);

// --- כל תשובה היא ציטוט מפריט, והימנעות היא בנוסח הנעול (BL-13, K3) ---

{
  const all = [...questionSet.answerable, ...questionSet.foreign, ...questionSet.known_limitations];
  const bad = [];
  for (const q of all) {
    const response = await retrieve(q.question);
    const { answer, is_fallback: fallback, source_item: source } = response.data;
    const quoted = fallback
      ? answer === referenceFile.values.fallback_text
      : items.find((item) => item.item_id === source)?.text.includes(answer);
    if (!quoted) bad.push(q.id);
  }
  check('כל תשובה היא ציטוט מהפריט שלה, וכל הימנעות בנוסח הנעול', bad, []);
}

// --- המגבלות הידועות: מדווחות, לא ברף ---

const limitations = [];
for (const q of questionSet.known_limitations) {
  const response = await retrieve(q.question);
  limitations.push(`${q.id}:${response.data.is_fallback ? 'הימנעות' : response.data.source_item}`);
}

report(` (מהפריט: ${itemHits}/20${itemMisses.length ? `, החטאות ${itemMisses.join(' ')}` : ''}; `
  + `מהמשפט: ${sentenceHits}/20; זרות שעברו: ${passed.length}/10${passed.length ? ` ${passed.join(' ')}` : ''}; `
  + `מגבלות ידועות: ${limitations.join(' ')})`);
