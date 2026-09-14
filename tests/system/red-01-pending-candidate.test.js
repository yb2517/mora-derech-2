// הבדיקה האדומה הראשונה, מפה 6.5 ו-usecase-f-05 זרימה ו.
//
// "פריט pending מוזרק למאגר המועמדים, והשליפה מחזירה אותו (F-05, K1)."
//
// זו אינה בדיקה רגילה. היא נכתבת כדי להיכשל אם ההגנה תוסר, וכשל
// אמיתי בה **חוסם שחרור**: הוא מפר את M-07 (0% חריגה מהמקור) ואת
// שרשרת שער B, ולא מדובר בבאג מקומי.
//
// היא רצה מקצה לקצה דרך ה-Orchestrator, ולא מול BE-04 לבדו, מפני
// שההגנה היא בסדר הפעולות: הסינון לפי מפתח קודם לכל דירוג. שליפה
// שתדרג קודם ותסנן אחר כך תחזיר את אותה תשובה ברוב המקרים ותיכשל
// בדיוק כאן.
//
//   node tests/system/red-01-pending-candidate.test.js

import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('אדומה F-05: פריט pending במאגר המועמדים');

const { createBrowserDriver } = await import('../../repository/driver-browser.js');
const { createRepository } = await import('../../repository/index.js');
const { createOrchestrator } = await import('../../core/orchestrator.js');
const { createEndpoint } = await import('../../screens/endpoint.js');
const { create: createRetrieval } = await import('../../services/retrieval.js');

const modulesFile = (await import('../../registry/modules.json', { with: { type: 'json' } })).default;
const allowFile = (await import('../../registry/allow-list.json', { with: { type: 'json' } })).default;
const referenceFile = (await import('../../data/reference.json', { with: { type: 'json' } })).default;

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

// המילה שהבדיקה רודפת אחריה. היא מופיעה **רק** בפריט שאינו מאושר,
// ולכן כל תשובה שאינה הימנעות היא הוכחה שההגנה נפלה.
const SMOKING_GUN = 'צלוחית';

const site = { site_id: 'site-red', name: 'מסלול', stops: ['stop-1'] };
const source = { source_id: 'src-red', name: 'מקור' };
const mou = {
  mou_id: 'mou-red', institute_id: 'inst-red', scope: ['src-red'],
  signed_at: '2026-09-01T00:00:00.000Z', valid_until: '2099-01-01T00:00:00.000Z',
};

const approved = {
  item_id: 'item-approved', site_id: 'site-red', stop_id: 'stop-1', status: 'approved',
  source_id: 'src-red', page: 3, audience: 'כולם', name: 'פריט מאושר',
  text: 'טקסט מאושר שאין בו שום דבר יוצא דופן.',
};

// ההזרקה עצמה: פריט שהחוקר לא אישר, שיושב במאגר לצד המאושר.
const injected = [
  { ...approved, item_id: 'item-pending', status: 'pending', name: 'פריט ממתין', text: `כאן עמדה ${SMOKING_GUN} עתיקה.` },
  { ...approved, item_id: 'item-draft', status: 'draft', name: 'טיוטה', text: `${SMOKING_GUN} נוספת הוזכרה בטיוטה.` },
  { ...approved, item_id: 'item-rejected', status: 'rejected', name: 'נדחה', text: `${SMOKING_GUN} שלישית, בפריט שנדחה.` },
];

const seed = {
  modules: modulesFile,
  allow_list: allowFile,
  reference: referenceFile.values,
  sites: [site],
  sources: [source],
  rights_mou: [mou],
  content_items: [approved, ...injected],
};

const repository = createRepository(createBrowserDriver({ storage: memoryStorage(), seed }));
const orchestrator = createOrchestrator({
  repository,
  handlers: { 'BE-04': createRetrieval({ repository }) },
});
const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });

const retrieve = (payload) => send({
  from: 'module-dialogue', module: 'BE-04', action: 'retrieve', payload,
});

// --- ההגנה: השאלה שמחפשת את הפריט שלא אושר ---

{
  const response = await retrieve({ question: `מה זו ה${SMOKING_GUN}?`, site_id: 'site-red' });

  check('הבקשה עברה', response.ok, true);

  // הטענה האדומה עצמה, בשלוש צורות. שלושתן חייבות להחזיק.
  check(
    'הפריט שאינו מאושר אינו נכנס למאגר המועמדים',
    response.data.considered.map((row) => row.item_id),
    ['item-approved'],
  );
  check('המילה שמופיעה רק בפריט שאינו מאושר אינה בתשובה',
    response.data.answer.includes(SMOKING_GUN), false);
  check('התשובה היא הימנעות', response.data.is_fallback, true);
  check('בנוסח הנעול מטבלת ה-reference',
    response.data.answer, referenceFile.values.fallback_text);
  check('ואין מקור לתשובה', response.data.source_item, null);
}

// --- אותה שאלה אחרי אישור: ההגנה אינה חוסמת תוכן מאושר ---

{
  // הבדיקה האדומה חייבת להיות ספציפית. אם היא עוברת גם כשהכול חסום,
  // היא אינה מודדת דבר. לכן: אותו פריט בדיוק, אחרי שמצבו approved,
  // כן נשלף.
  repository.setStatus('item-pending', 'approved');
  const response = await retrieve({ question: `מה זו ה${SMOKING_GUN}?`, site_id: 'site-red' });

  check('אחרי אישור הפריט נשלף', response.data.source_item, 'item-pending');
  check('והתשובה אינה הימנעות', response.data.is_fallback, false);
  check('והטקסט הוא ציטוט מהפריט', response.data.answer.includes(SMOKING_GUN), true);
}

// --- הסדר הוא חלק מהחוזה: סינון לפני דירוג ---

{
  // הפריט שנשאר pending מדורג גבוה מהמאושר לשאלה הזאת, ובכל זאת
  // אינו מגיע לדירוג כלל. זה מה שמבדיל בין סינון לפני לסינון אחרי.
  repository.setStatus('item-pending', 'pending');
  const response = await retrieve({ question: `${SMOKING_GUN} עתיקה`, site_id: 'site-red' });

  check('המועמדים שנשקלו הם המאושרים בלבד',
    response.data.considered.map((row) => row.item_id), ['item-approved']);
  check('ולא הוחזר ציון לפריט שאינו מאושר',
    response.data.considered.some((row) => row.item_id.includes('pending')), false);
}

report();
