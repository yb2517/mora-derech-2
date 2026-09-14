// Unit של BE-05, Content Governance. נגזר מבדיקת הקבלה של משימה 3
// בתוכנית שלב 3, מ-usecase-f-07 (הזרימה הראשית וזרימות ב, ג, ד),
// מ-BL-01 ומ-BL-02, ומשורות BE-05 במפה 6.1.
//
//   node tests/unit/governance.test.js

import { create } from '../../services/governance.js';
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, report } = createChecker('BE-05 governance');

// Repository מזויף: אותם שמות עסקיים, בזיכרון. הוא מאפשר להכשיל
// כתיבה אחת בדיוק, וזו בדיקת הקבלה של BL-01.
function fakeRepository({
  failApprovals = false, failStatus = false, siteStatus = 'open',
  reference = { note_max_chars: 200 },
} = {}) {
  const data = {
    // page ו-audience נוספו במשימה 3 של שלב 4: מרגע ש-edit_item
    // בודק שלמות (usecase-f-08 צעד 3), פריט בלי עמוד אינו שלם.
    items: [
      { item_id: 'i-draft', site_id: 's-1', stop_id: 'st-1', status: 'draft', source_id: 'src-1', text: 'טקסט', page: 3, audience: 'כולם' },
      { item_id: 'i-pending', site_id: 's-1', stop_id: 'st-1', status: 'pending', source_id: 'src-1', text: 'טקסט', page: 5, audience: 'כולם' },
      { item_id: 'i-approved', site_id: 's-1', stop_id: 'st-2', status: 'approved', source_id: 'src-2', text: 'טקסט', page: 7, audience: 'כולם' },
      { item_id: 'i-rejected', site_id: 's-1', stop_id: 'st-2', status: 'rejected', source_id: 'src-2', text: 'טקסט', page: 9, audience: 'כולם' },
    ],
    approvals: [],
    sites: [{
      site_id: 's-1',
      name: 'מסלול',
      status: siteStatus,
      stops: ['st-1', 'st-2'],
      bounds: { min_lat: 31.77, max_lat: 31.79, min_lng: 35.20, max_lng: 35.23 },
      corpus_version: null,
    }],
    sources: [{ source_id: 'src-1', name: 'מקור א' }, { source_id: 'src-2', name: 'מקור ב' }],
    institutes: [{ institute_id: 'inst-1', name: 'מכון' }],
    mou: [],
    anchors: [
      { anchor_id: 'a-approved', item_id: 'i-approved', lat: 31.781, lng: 35.219, verified: true, verified_at: '2026-09-02T00:00:00.000Z', is_crossing: false },
      { anchor_id: 'a-draft', item_id: 'i-draft', lat: 31.782, lng: 35.218, verified: false, verified_at: null, is_crossing: false },
      { anchor_id: 'a-pending', item_id: 'i-pending', lat: 31.783, lng: 35.217, verified: false, verified_at: null, is_crossing: false },
      { anchor_id: 'a-rejected', item_id: 'i-rejected', lat: 31.784, lng: 35.216, verified: false, verified_at: null, is_crossing: false },
    ],
    exitPoints: [],
  };

  return {
    data,
    getRef: (key) => reference[key],
    getItem: (id) => data.items.find((row) => row.item_id === id) ?? null,
    listItems: ({ site_id: siteId, stop_id: stopId, status } = {}) => data.items
      .filter((row) => siteId === undefined || row.site_id === siteId)
      .filter((row) => stopId === undefined || row.stop_id === stopId)
      .filter((row) => status === undefined || row.status === status)
      .map((row) => ({ ...row })),
    appendItem: (record) => { data.items.push({ ...record }); return { ...record }; },
    updateItem: (id, patch) => {
      const row = data.items.find((item) => item.item_id === id);
      if (!row) return null;
      Object.assign(row, patch);
      return { ...row };
    },
    updateSite: (id, patch) => {
      const row = data.sites.find((site) => site.site_id === id);
      if (!row) return null;
      Object.assign(row, patch);
      return { ...row };
    },
    getAnchor: (id) => data.anchors.find((row) => row.anchor_id === id) ?? null,
    getAnchorByItem: (id) => data.anchors.find((row) => row.item_id === id) ?? null,
    listAnchors: () => data.anchors.map((row) => ({ ...row })),
    appendAnchor: (record) => { data.anchors.push({ ...record }); return { ...record }; },
    updateAnchor: (id, patch) => {
      const row = data.anchors.find((anchor) => anchor.anchor_id === id);
      if (!row) return null;
      Object.assign(row, patch);
      return { ...row };
    },
    listExitPoints: ({ site_id: siteId } = {}) => data.exitPoints
      .filter((row) => siteId === undefined || row.site_id === siteId)
      .map((row) => ({ ...row })),
    appendExitPoint: (record) => { data.exitPoints.push({ ...record }); return { ...record }; },
    setStatus: (id, status) => {
      if (failStatus) throw new Error('כתיבת המצב נכשלה');
      const row = data.items.find((item) => item.item_id === id);
      if (!row) return null;
      row.status = status;
      return { ...row };
    },
    appendApproval: (record) => {
      if (failApprovals) throw new Error('כתיבת היומן נכשלה');
      data.approvals.push(record);
      return record;
    },
    listApprovals: ({ target } = {}) => data.approvals
      .filter((row) => target === undefined || row.target === target),
    getSite: (id) => (id === undefined ? data.sites[0] : data.sites.find((s) => s.site_id === id)) ?? null,
    listSources: () => data.sources.map((row) => ({ ...row })),
    listInstitutes: () => data.institutes.map((row) => ({ ...row })),
    listMou: () => data.mou.map((row) => ({ ...row })),
    appendMou: (record) => { data.mou.push(record); return record; },
    appendInstitute: (record) => { data.institutes.push(record); return record; },
    appendSource: (record) => { data.sources.push(record); return record; },
  };
}

let counter = 0;
const options = (repository) => ({
  repository,
  newId: () => `id-${++counter}`,
  now: () => '2026-09-14T12:00:00.000Z',
});

// שם הפונה הוא ארגומנט מאז משימה 3 של שלב 4: פעולות התוכן מגיעות
// מ-screen-content, המסירה מ-module-delivery, והמעבר מ-screen-veto.
// הרשאה אינה נבדקת כאן אלא ב-CORE-02, ומה שנבדק כאן הוא מה שנרשם.
const envelope = (action, payload = {}, from = 'screen-veto') => ({
  from, module: 'BE-05', action, payload, lang: 'he',
});

// --- הזרימה הראשית: אישור פריט (usecase-f-07 צעדים 6 עד 9) ---

{
  const repository = fakeRepository();
  const handle = create(options(repository));

  const response = handle(envelope('approve', { item_id: 'i-pending', note: 'מדויק' }));

  check('התשובה מוצלחת', response.ok, true);
  check('המצב החדש', response.data.status, 'approved');
  check('המצב הקודם חוזר עם התשובה', response.data.from_status, 'pending');
  check('המצב השתנה בנתונים', repository.getItem('i-pending').status, 'approved');

  // בדיקת הקבלה של השלב: רשומה עם זמן, מבצע, מצב קודם וחדש.
  check('נרשמה רשומת APPROVALS אחת', repository.data.approvals.length, 1);
  check('הרשומה מלאה', repository.data.approvals[0], {
    approval_id: 'appr-id-1',
    time: '2026-09-14T12:00:00.000Z',
    who: 'screen-veto',
    target: 'i-pending',
    action: 'approve',
    from_status: 'pending',
    to_status: 'approved',
    note: 'מדויק',
  });

  // usecase-f-07 צעד 11: המונים חוזרים עם התשובה.
  check('המונים של המסלול', response.data.counts, {
    draft: 1, pending: 0, approved: 2, rejected: 1,
  });

  // מצב השער אינו בתשובה: הוא של BE-06, ואף מודול אינו קורא למודול.
  check('אין מצב שער בתשובה של BE-05', 'gate' in response.data, false);
}

// --- ארבע פעולות המעבר ---

{
  const repository = fakeRepository();
  const handle = create(options(repository));

  check('submit על draft', handle(envelope('submit', { item_id: 'i-draft' })).data.status, 'pending');
  check('reject על pending', handle(envelope('reject', { item_id: 'i-pending' })).data.status, 'rejected');
  check('return על approved', handle(envelope('return', { item_id: 'i-approved' })).data.status, 'pending');
  check('return על rejected', handle(envelope('return', { item_id: 'i-rejected' })).data.status, 'pending');
  check('ארבע רשומות ביומן', repository.data.approvals.length, 4);
}

// --- זרימה ד: מעבר מצב אסור (שורת BE-05 במפה 6.1) ---

{
  const repository = fakeRepository();
  const handle = create(options(repository));

  const response = handle(envelope('approve', { item_id: 'i-approved' }));
  check('approve על פריט approved נדחה', response.error.code, 'E-TRANSITION-DENIED');
  check('אין רשומה חדשה', repository.data.approvals.length, 0);
  check('המצב לא השתנה', repository.getItem('i-approved').status, 'approved');

  check('submit על rejected נדחה', handle(envelope('submit', { item_id: 'i-rejected' })).error.code, 'E-TRANSITION-DENIED');
}

// --- פריט שאינו קיים, ובקשה בלי מזהה ---

{
  const handle = create(options(fakeRepository()));
  check('פריט שאינו קיים', handle(envelope('approve', { item_id: 'i-404' })).error.code, 'E-TRANSITION-DENIED');
  check('בקשה בלי מזהה פריט', handle(envelope('approve', {})).error.code, 'E-TRANSITION-DENIED');
}

// --- BL-01: כשל כתיבת היומן מבטל את המעבר (usecase-f-07 זרימה ב) ---

{
  const repository = fakeRepository({ failApprovals: true });
  const handle = create(options(repository));

  const response = handle(envelope('approve', { item_id: 'i-pending' }));

  check('הקוד הוא של כשל כתיבת היומן', response.error.code, 'E-APPROVAL-WRITE-FAILED');
  check('error.data נושא את הפריט', response.error.data.item_id, 'i-pending');
  check('**המצב לא השתנה**', repository.getItem('i-pending').status, 'pending');
  check('לא נרשמה רשומה', repository.data.approvals.length, 0);
}

// המקרה ההפוך: הרשומה נכתבה והמצב לא. אין לו קוד ברשימה הסגורה,
// ולכן הוא נופל ל-E-MODULE-FAILED של ה-Orchestrator ואינו נבלע.
{
  const repository = fakeRepository({ failStatus: true });
  const handle = create(options(repository));
  checkThrows('כשל כתיבת המצב אינו נבלע', () => handle(envelope('approve', { item_id: 'i-pending' })));
  check('והרשומה נשארה כעדות', repository.data.approvals.length, 1);
}

// --- ההערה: רשות (usecase-f-07 צעד 6, הוכרע 10.09.2026) ---

{
  const repository = fakeRepository();
  const handle = create(options(repository));

  handle(envelope('reject', { item_id: 'i-pending' }));
  check('דחייה בלי הערה נרשמת, וההערה ריקה', repository.data.approvals[0].note, '');

  // פער 38 נסגר במפה גרסה 3.4 במפתח note_max_chars, והאכיפה נכנסה
  // במשימה 10 של שלב 4: ההערה נקצצת לגבול שבטבלה. הבדיקה המפורטת
  // יושבת בסעיף של משימה 10 למטה.
  handle(envelope('return', { item_id: 'i-approved', note: 'א'.repeat(250) }));
  check('הערה ארוכה נקצצת לגבול שבטבלה', repository.data.approvals[1].note.length, 200);
}

// --- רישום ההסכם (usecase-f-07 צעדים 12 ו-13) ---

{
  const repository = fakeRepository();
  const handle = create(options(repository));

  const mou = {
    institute_id: 'inst-1',
    scope: ['src-1', 'src-2'],
    signed_at: '2026-09-01',
    valid_until: '2027-09-01',
    covers_content_contribution: true,
  };

  const response = handle(envelope('register_mou', mou));
  check('ההסכם נרשם', response.ok, true);
  check('ההיקף נשמר', response.data.mou.scope, ['src-1', 'src-2']);
  check('ההסכם קריא אחר כך', handle(envelope('listMou')).data.mou.length, 1);
  check('ההסכם מכסה גם תרומת תוכן', response.data.mou.covers_content_contribution, true);

  check('בלי מכון', handle(envelope('register_mou', { ...mou, institute_id: '' })).error.data.field, 'institute_id');
  check('בלי היקף', handle(envelope('register_mou', { ...mou, scope: [] })).error.data.field, 'scope');
  check('בלי תאריך תוקף', handle(envelope('register_mou', { ...mou, valid_until: '' })).error.data.field, 'valid_until');
  check('הקוד של שדה חסר', handle(envelope('register_mou', { ...mou, scope: [] })).error.code, 'E-ITEM-INCOMPLETE');
  check('מכון שאינו רשום', handle(envelope('register_mou', { ...mou, institute_id: 'inst-9' })).error.data.field, 'institute_id');
  check('מקור שאינו רשום בהיקף', handle(envelope('register_mou', { ...mou, scope: ['src-9'] })).error.data.unknown, ['src-9']);
  check('נרשם הסכם אחד בלבד', repository.data.mou.length, 1);
}

// --- רישום מכון ומקור ---

{
  const repository = fakeRepository();
  const handle = create(options(repository));

  check('מכון חדש', handle(envelope('register_institute', { name: 'מכון שני' })).data.institute.name, 'מכון שני');
  check('מכון בלי שם', handle(envelope('register_institute', {})).error.code, 'E-ITEM-INCOMPLETE');
  check('מקור חדש', handle(envelope('register_source', { name: 'מקור ג' })).data.source.name, 'מקור ג');
  check('מקור בלי שם', handle(envelope('register_source', {})).error.data.field, 'name');
}

// --- פעולות הקריאה שהמסכים מציגים ---

{
  const handle = create(options(fakeRepository()));

  check('listItems לפי מסלול', handle(envelope('listItems', { site_id: 's-1' })).data.items.length, 4);
  check('listItems לפי מצב', handle(envelope('listItems', { status: 'pending' })).data.items.length, 1);

  // הרשימה אינה נושאת את הטקסט המלא: הוא נטען בפתיחת הפריט.
  check('הרשימה בלי הטקסט', 'text' in handle(envelope('listItems', {})).data.items[0], false);

  const item = handle(envelope('getItem', { item_id: 'i-pending' })).data;
  check('getItem מחזיר את הפריט עם הטקסט', item.item.text, 'טקסט');
  check('ואת המקור שלו', item.source.name, 'מקור א');
  check('getItem על מזהה שאינו קיים מחזיר null עם ok', handle(envelope('getItem', { item_id: 'i-404' })), {
    ok: true, data: { item: null, source: null },
  });

  check('getSite', handle(envelope('getSite', {})).data.site.site_id, 's-1');
  check('listSources', handle(envelope('listSources', {})).data.sources.length, 2);
  check('listInstitutes', handle(envelope('listInstitutes', {})).data.institutes.length, 1);
  check('listApprovals פותח ריק', handle(envelope('listApprovals', {})).data.approvals, []);
}

// ---------------------------------------------------------------------
// משימה 3 בתוכנית שלב 4: פעולות התוכן של F-08 ושל F-13
// ---------------------------------------------------------------------

const ITEM = {
  site_id: 's-1', stop_id: 'st-1', name: 'פריט חדש', text: 'טקסט של שלוש מילים',
  page: 12, source_id: 'src-1', lat: 31.781, lng: 35.219,
};

// --- create_item, usecase-f-08 צעדים 1 עד 4 ---

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const response = handle(envelope('create_item', ITEM, 'screen-content'));

  check('היצירה מוצלחת', response.ok, true);
  check('הפריט נולד ב-draft', response.data.item.status, 'draft');
  check('word_count נגזר מהטקסט ואינו מתקבל', response.data.item.word_count, 4);
  check('העוגן נולד לא מאומת', response.data.anchor.verified, false);
  check('והעוגן נולד בלי סימון חצייה', response.data.anchor.is_crossing, false);
  check('העוגן מקושר לפריט', response.data.anchor.item_id, response.data.item.item_id);
  check('נרשמה רשומת APPROVALS אחת', repository.data.approvals.length, 1);
  check('הרשומה היא מעבר מ(חדש) ל-draft', [
    repository.data.approvals[0].from_status, repository.data.approvals[0].to_status,
  ], [null, 'draft']);
  check('והמבצע הוא הפונה שהמעטפה נשאה', repository.data.approvals[0].who, 'screen-content');
}

// בדיקת הקבלה: שדה חסר, ושם השדה ב-error.data.
{
  const handle = create(options(fakeRepository()));
  for (const field of ['text', 'page', 'stop_id', 'source_id']) {
    const response = handle(envelope('create_item', { ...ITEM, [field]: undefined }, 'screen-content'));
    check(`יצירה בלי ${field} נדחית`, response.error.code, 'E-ITEM-INCOMPLETE');
    check(`ו-error.data נושא את שם השדה ${field}`, response.error.data.field, field);
  }
  check('טקסט של רווחים בלבד אינו טקסט',
    handle(envelope('create_item', { ...ITEM, text: '   ' }, 'screen-content')).error.data.field, 'text');
}

{
  const handle = create(options(fakeRepository()));
  check('תחנה שאינה ברשימת התחנות של המסלול נדחית',
    handle(envelope('create_item', { ...ITEM, stop_id: 'st-9' }, 'screen-content')).error.data.field, 'stop_id');
  check('מקור שאינו רשום נדחה',
    handle(envelope('create_item', { ...ITEM, source_id: 'src-9' }, 'screen-content')).error.data.field, 'source_id');
  check('קואורדינטה חסרה היא שדה חסר',
    handle(envelope('create_item', { ...ITEM, lat: undefined }, 'screen-content')).error.data.field, 'lat');
}

// בדיקת הקבלה: קואורדינטות מחוץ לגבולות.
{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const response = handle(envelope('create_item', { ...ITEM, lat: 32.9 }, 'screen-content'));

  check('קואורדינטות מחוץ לגבולות נדחות', response.error.code, 'E-ANCHOR-OUT-OF-BOUNDS');
  check('והגבולות חוזרים עם השגיאה', response.error.data.bounds.max_lat, 31.79);
  check('ולא נכתבה רשומה', repository.data.approvals.length, 0);
  check('ולא נוצר פריט', repository.data.items.length, 4);
}

// פער 39: מסלול בלי גבולות. הבדיקה אינה רצה ואינה ממציאה גבול.
{
  const repository = fakeRepository();
  delete repository.data.sites[0].bounds;
  const handle = create(options(repository));
  check('מסלול בלי גבולות אינו חוסם יצירה',
    handle(envelope('create_item', { ...ITEM, lat: 32.9 }, 'screen-content')).ok, true);
}

// BL-01: כשל כתיבת הרשומה מבטל את היצירה.
{
  const repository = fakeRepository({ failApprovals: true });
  const handle = create(options(repository));
  const response = handle(envelope('create_item', ITEM, 'screen-content'));

  check('כשל כתיבת היומן מחזיר E-APPROVAL-WRITE-FAILED', response.error.code, 'E-APPROVAL-WRITE-FAILED');
  check('ולא נוצר פריט', repository.data.items.length, 4);
  check('ולא נוצר עוגן', repository.data.anchors.length, 4);
}

// --- edit_item: ארבעה מצבים, שלוש התנהגויות ---

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const response = handle(envelope('edit_item', { item_id: 'i-draft', text: 'טקסט חדש לגמרי' }, 'screen-content'));

  check('עריכת draft מוצלחת', response.ok, true);
  check('והמצב נשאר draft', response.data.status, 'draft');
  check('הטקסט השתנה', repository.getItem('i-draft').text, 'טקסט חדש לגמרי');
  check('word_count חושב מחדש', repository.getItem('i-draft').word_count, 3);
  check('אין מעבר מצב, ולכן אין רשומה', repository.data.approvals.length, 0);
}

// זרימה ה של usecase-f-07, והשורה approved ל-draft בטבלה שבליבה.
{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const response = handle(envelope('edit_item', { item_id: 'i-approved', text: 'טקסט מתוקן' }, 'screen-content'));

  check('עריכת פריט מאושר מחזירה אותו ל-draft', response.data.status, 'draft');
  check('והמצב הקודם מדווח', response.data.from_status, 'approved');
  check('נרשמה רשומה', repository.data.approvals.length, 1);
  check('והפעולה שנרשמה היא revert', repository.data.approvals[0].action, 'revert');
}

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  check('עריכת פריט שנדחה מחזירה אותו ל-draft',
    handle(envelope('edit_item', { item_id: 'i-rejected', text: 'טקסט מתוקן' }, 'screen-content')).data.status, 'draft');
  check('והפעולה שנרשמה היא edit_item', repository.data.approvals[0].action, 'edit_item');
}

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const response = handle(envelope('edit_item', { item_id: 'i-pending', text: 'טקסט' }, 'screen-content'));

  check('פריט שנמצא אצל החוקר אינו נערך', response.error.code, 'E-TRANSITION-DENIED');
  check('ולא נרשמה רשומה', repository.data.approvals.length, 0);
  check('והטקסט לא השתנה', repository.getItem('i-pending').text, 'טקסט');
}

{
  const handle = create(options(fakeRepository()));
  check('עריכת פריט שאינו קיים נדחית',
    handle(envelope('edit_item', { item_id: 'i-none', text: 'טקסט' }, 'screen-content')).error.code, 'E-TRANSITION-DENIED');
}

{
  const repository = fakeRepository({ failApprovals: true });
  const handle = create(options(repository));
  check('כשל כתיבת הרשומה מבטל את העריכה',
    handle(envelope('edit_item', { item_id: 'i-approved', text: 'חדש' }, 'screen-content')).error.code,
    'E-APPROVAL-WRITE-FAILED');
  check('והמצב לא השתנה', repository.getItem('i-approved').status, 'approved');
  check('והטקסט לא השתנה', repository.getItem('i-approved').text, 'טקסט');
}

// --- BL-07 ו-L6: עריכה במסלול נעול פותחת אותו ---

{
  const repository = fakeRepository({ siteStatus: 'locked' });
  const handle = create(options(repository));
  const response = handle(envelope('edit_item', { item_id: 'i-approved', text: 'טקסט מתוקן' }, 'screen-content'));

  check('הפריט חזר ל-draft', response.data.status, 'draft');
  check('והמסלול נפתח', repository.getSite('s-1').status, 'open');
  check('והמסך יודע שזה קרה', response.data.site_reopened, true);
  check('שתי רשומות: הפריט והמסלול', repository.data.approvals.length, 2);
  check('רשומת המסלול היא locked ל-open', [
    repository.data.approvals[1].target,
    repository.data.approvals[1].from_status,
    repository.data.approvals[1].to_status,
  ], ['s-1', 'locked', 'open']);
}

{
  const repository = fakeRepository({ siteStatus: 'locked' });
  const handle = create(options(repository));
  handle(envelope('create_item', ITEM, 'screen-content'));
  check('יצירה במסלול נעול פותחת אותו', repository.getSite('s-1').status, 'open');
}

{
  const repository = fakeRepository({ siteStatus: 'locked' });
  const handle = create(options(repository));
  handle(envelope('approve', { item_id: 'i-pending' }, 'screen-veto'));
  check('אישור אינו פותח מסלול נעול', repository.getSite('s-1').status, 'locked');
}

// --- verify_anchor, usecase-f-08 צעדים 7 ו-8, ו-is_crossing של F-13 ---

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const response = handle(envelope('verify_anchor', { item_id: 'i-draft', is_crossing: true }, 'screen-content'));

  check('העוגן אומת', response.data.anchor.verified, true);
  check('וזמן האימות נרשם', typeof response.data.anchor.verified_at, 'string');
  check('ו-is_crossing נשמר', response.data.anchor.is_crossing, true);
  check('ונרשמה רשומה', repository.data.approvals.length, 1);
  check('הפעולה שנרשמה', repository.data.approvals[0].action, 'verify_anchor');
}

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  handle(envelope('verify_anchor', { anchor_id: 'a-draft', lat: 31.7815, lng: 35.2185 }, 'screen-content'));
  check('אימות מתקן קואורדינטות', repository.getAnchor('a-draft').lat, 31.7815);
  check('ובלי סימון, is_crossing נשאר false', repository.getAnchor('a-draft').is_crossing, false);
}

// הכרעה 11: אימות עוגן אינו מחזיר פריט מאושר ל-draft.
{
  const repository = fakeRepository({ siteStatus: 'locked' });
  const handle = create(options(repository));
  handle(envelope('verify_anchor', { item_id: 'i-approved' }, 'screen-content'));

  check('הפריט המאושר נשאר מאושר', repository.getItem('i-approved').status, 'approved');
  check('והמסלול נשאר נעול', repository.getSite('s-1').status, 'locked');
}

{
  const handle = create(options(fakeRepository()));
  check('אימות עוגן שאינו קיים נדחה',
    handle(envelope('verify_anchor', { anchor_id: 'a-none' }, 'screen-content')).error.data.field, 'anchor_id');
  check('קואורדינטות מחוץ לגבולות נדחות גם באימות',
    handle(envelope('verify_anchor', { item_id: 'i-draft', lat: 32.9, lng: 35.21 }, 'screen-content')).error.code,
    'E-ANCHOR-OUT-OF-BOUNDS');
}

// --- register_exit_point ו-nearestExitPoint, F-13 תיקון 1 ---

{
  const repository = fakeRepository();
  const handle = create(options(repository));

  check('מסלול בלי נקודת יציאה מחזיר E-NO-EXIT-POINT',
    handle(envelope('nearestExitPoint', { site_id: 's-1', lat: 31.781, lng: 35.219 }, 'screen-traveler')).error.code,
    'E-NO-EXIT-POINT');

  check('רישום בלי שם נדחה',
    handle(envelope('register_exit_point', { site_id: 's-1', lat: 31.78, lng: 35.21 }, 'screen-content')).error.data.field, 'name');

  handle(envelope('register_exit_point', { site_id: 's-1', lat: 31.7900, lng: 35.2300, name: 'רחוקה' }, 'screen-content'));
  handle(envelope('register_exit_point', { site_id: 's-1', lat: 31.7812, lng: 35.2191, name: 'קרובה', type: 'תחבורה' }, 'screen-content'));

  const nearest = handle(envelope('nearestExitPoint', { site_id: 's-1', lat: 31.781, lng: 35.219 }, 'screen-traveler'));
  check('הקרובה נבחרת', nearest.data.exit_point.name, 'קרובה');
  check('והמרחק מוחזר במטרים', nearest.data.distance_m < 50, true);
  check('שתי הנקודות ברשימה', handle(envelope('listExitPoints', { site_id: 's-1' }, 'screen-content')).data.exit_points.length, 2);

  const blind = handle(envelope('nearestExitPoint', { site_id: 's-1' }, 'screen-traveler'));
  check('בלי מיקום מוחזרת נקודה בלי מרחק', blind.data.distance_m, null);
}

// --- listApprovedByStop: K1 מוחל על המסירה ---

{
  const repository = fakeRepository();
  repository.data.items.push({
    item_id: 'i-adults', site_id: 's-1', stop_id: 'st-1', status: 'approved',
    source_id: 'src-1', text: 'טקסט', audience: 'מבוגרים בלבד',
  });
  repository.data.items.push({
    item_id: 'i-all', site_id: 's-1', stop_id: 'st-1', status: 'approved',
    source_id: 'src-1', text: 'טקסט', audience: 'כולם',
  });
  const handle = create(options(repository));
  const ask = (payload) => handle(envelope('listApprovedByStop', payload, 'module-delivery'));

  check('פריט pending אינו מוחזר במסירה',
    ask({ site_id: 's-1', stop_id: 'st-1' }).data.items.map((row) => row.item_id), ['i-all']);
  check('פריט draft אינו מוחזר',
    ask({ site_id: 's-1', stop_id: 'st-1' }).data.items.some((row) => row.item_id === 'i-draft'), false);
  check('תחנה בלי פריט מאושר מחזירה רשימה ריקה',
    ask({ site_id: 's-1', stop_id: 'st-9' }).data.items, []);

  // BL-21 ופער 43: בלי audience בבקשה עוברים פריטי "כולם" בלבד.
  check('פריט למבוגרים בלבד אינו עובר בברירת המחדל',
    ask({ site_id: 's-1', stop_id: 'st-1' }).data.items.some((row) => row.item_id === 'i-adults'), false);
  check('ועם audience מפורש הוא עובר',
    ask({ site_id: 's-1', stop_id: 'st-1', audience: 'מבוגרים בלבד' }).data.items.map((row) => row.item_id),
    ['i-adults', 'i-all']);
}

// ---------------------------------------------------------------------
// משימה 10 בתוכנית שלב 4: אכיפת note_max_chars (פער 38, הכרעה 15)
// ---------------------------------------------------------------------

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const short = 'הערה קצרה.';
  handle(envelope('reject', { item_id: 'i-pending', note: short }, 'screen-veto'));

  check('הערה בתוך הגבול נשמרת במלואה', repository.data.approvals[0].note, short);
}

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const long = 'א'.repeat(250);
  handle(envelope('reject', { item_id: 'i-pending', note: long }, 'screen-veto'));

  check('הערה ארוכה נקצצת', repository.data.approvals[0].note.length, 200);
  check('ולא נדחית', repository.data.approvals.length, 1);
  check('והפריט עבר', repository.getItem('i-pending').status, 'rejected');
  check('והקיצוץ הוא מההתחלה', repository.data.approvals[0].note, long.slice(0, 200));
}

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const exact = 'א'.repeat(200);
  handle(envelope('reject', { item_id: 'i-pending', note: exact }, 'screen-veto'));
  check('הערה באורך הגבול בדיוק אינה נגעת', repository.data.approvals[0].note, exact);
}

{
  // הגבול נקרא מהטבלה ולא מהקוד: טבלה אחרת, גבול אחר.
  const repository = fakeRepository({ reference: { note_max_chars: 10 } });
  const handle = create(options(repository));
  handle(envelope('reject', { item_id: 'i-pending', note: 'א'.repeat(50) }, 'screen-veto'));
  check('ערך אחר בטבלה משנה את הקיצוץ', repository.data.approvals[0].note.length, 10);
}

{
  // חוק ברזל 5, בגבולותיו: המפתח נדרש רק כשיש הערה.
  const repository = fakeRepository({ reference: { note_max_chars: null } });
  const handle = create(options(repository));

  check('מעבר בלי הערה עובר גם כשהמפתח ריק',
    handle(envelope('approve', { item_id: 'i-pending' }, 'screen-veto')).ok, true);

  const withNote = handle(envelope('return', { item_id: 'i-pending', note: 'הערה' }, 'screen-veto'));
  check('מעבר עם הערה מחזיר E-REF-EMPTY', withNote.error.code, 'E-REF-EMPTY');
  check('ו-error.data נושא את שם ההגדרה', withNote.error.data.key, 'note_max_chars');
}

// ---------------------------------------------------------------------
// משימה 4 בתוכנית שלב 4: הנעילה, usecase-f-08 צעדים 10 עד 12
// ---------------------------------------------------------------------

// מסלול שכל ארבעת התנאים מתקיימים בו. הוא נבנה מהמסלול של הבדיקות
// הקודמות בכך שכל פריט הוכרע, לכל תחנה יש מאושר, לכל מאושר עוגן
// מאומת ורשומת אישור, ולמקורות יש הסכם בתוקף.
function lockableRepository(overrides = {}) {
  const repository = fakeRepository(overrides);
  repository.data.items = [
    { item_id: 'i-a', site_id: 's-1', stop_id: 'st-1', status: 'approved', source_id: 'src-1', text: 'טקסט', page: 3, audience: 'כולם' },
    { item_id: 'i-b', site_id: 's-1', stop_id: 'st-2', status: 'approved', source_id: 'src-1', text: 'טקסט', page: 5, audience: 'כולם' },
  ];
  repository.data.anchors = [
    { anchor_id: 'an-a', item_id: 'i-a', lat: 31.781, lng: 35.219, verified: true, verified_at: 'T', is_crossing: false },
    { anchor_id: 'an-b', item_id: 'i-b', lat: 31.782, lng: 35.218, verified: true, verified_at: 'T', is_crossing: false },
  ];
  repository.data.approvals = [
    { approval_id: 'ap-a', target: 'i-a', action: 'approve', from_status: 'pending', to_status: 'approved' },
    { approval_id: 'ap-b', target: 'i-b', action: 'approve', from_status: 'pending', to_status: 'approved' },
  ];
  repository.data.mou = [{
    mou_id: 'mou-1', institute_id: 'inst-1', scope: ['src-1'],
    signed_at: '2026-09-01T00:00:00.000Z', valid_until: '2099-01-01T00:00:00.000Z',
  }];
  return repository;
}

const lockEnvelope = (payload = {}) => envelope('lock_site', payload, 'screen-owner');

// --- בדיקת הקבלה: נעילה שכל תנאיה מתקיימים ---

{
  const repository = lockableRepository();
  const handle = create(options(repository));
  const before = repository.data.approvals.length;
  const response = handle(lockEnvelope({ site_id: 's-1' }));

  check('הנעילה מוצלחת', response.ok, true);
  check('המסלול נעול', repository.getSite('s-1').status, 'locked');
  check('locked_at נרשם', typeof repository.getSite('s-1').locked_at, 'string');
  check('corpus_version הוא 1 בנעילה הראשונה', repository.getSite('s-1').corpus_version, 1);
  check('נרשמה רשומה אחת', repository.data.approvals.length - before, 1);

  const record = repository.data.approvals.at(-1);
  check('הרשומה היא על המסלול', record.target, 's-1');
  check('והמעבר הוא open ל-locked', [record.from_status, record.to_status], ['open', 'locked']);
  check('והמבצע הוא בעלת הפרויקט', record.who, 'screen-owner');
  check('וגרסת הקורפוס נרשמה בהערה', record.note, 'corpus_version 1');
}

// --- בדיקת הקבלה: תחנה בלי פריט מאושר ---

{
  const repository = lockableRepository();
  repository.data.items = repository.data.items.filter((row) => row.stop_id !== 'st-2');
  repository.data.anchors = repository.data.anchors.filter((row) => row.item_id !== 'i-b');
  const handle = create(options(repository));
  const response = handle(lockEnvelope({ site_id: 's-1' }));

  check('הנעילה נדחית', response.error.code, 'E-LOCK-REFUSED');
  check('רשימת הכשלים נושאת את L2', response.error.data.failed, ['L2']);
  check('והתחנה המכשילה חוזרת בשמה',
    response.error.data.conditions.find((row) => row.id === 'L2').failing, ['st-2']);
  check('והמסלול לא השתנה', repository.getSite('s-1').status, 'open');
  check('ולא נרשמה רשומה', repository.data.approvals.length, 2);
}

// --- ההגנה של הבדיקה האדומה השנייה, דרך הפעולה ---

{
  const repository = lockableRepository();
  // פריט approved שהוזרק ישירות, בלי שעבר את הווטו.
  repository.data.items.push({
    item_id: 'i-smuggled', site_id: 's-1', stop_id: 'st-1', status: 'approved',
    source_id: 'src-1', text: 'טקסט', page: 9, audience: 'כולם',
  });
  repository.data.anchors.push({
    anchor_id: 'an-s', item_id: 'i-smuggled', lat: 31.781, lng: 35.219, verified: true, verified_at: 'T', is_crossing: false,
  });
  const handle = create(options(repository));
  const response = handle(lockEnvelope({ site_id: 's-1' }));

  check('פריט מאושר בלי רשומה חוסם נעילה', response.error.code, 'E-LOCK-REFUSED');
  check('והכשל הוא L1', response.error.data.failed, ['L1']);
  check('והפריט חוזר בשמו',
    response.error.data.conditions.find((row) => row.id === 'L1').failing, ['i-smuggled']);
}

// --- שאר התנאים חוסמים גם הם ---

{
  const repository = lockableRepository();
  repository.data.anchors[1].verified = false;
  check('עוגן שלא אומת חוסם נעילה',
    create(options(repository))(lockEnvelope({ site_id: 's-1' })).error.data.failed, ['L3']);
}

{
  const repository = lockableRepository();
  repository.data.mou = [];
  check('בלי הסכם בתוקף אין נעילה',
    create(options(repository))(lockEnvelope({ site_id: 's-1' })).error.data.failed, ['L4']);
}

{
  const repository = lockableRepository();
  repository.data.items.push({
    item_id: 'i-open', site_id: 's-1', stop_id: 'st-1', status: 'pending',
    source_id: 'src-1', text: 'טקסט', page: 11, audience: 'כולם',
  });
  check('פריט שטרם הוכרע חוסם נעילה',
    create(options(repository))(lockEnvelope({ site_id: 's-1' })).error.data.failed, ['L1']);
}

// --- BL-01: כשל כתיבת הרשומה מבטל את הנעילה ---

{
  const repository = lockableRepository({ failApprovals: true });
  const handle = create(options(repository));
  const response = handle(lockEnvelope({ site_id: 's-1' }));

  check('כשל היומן מחזיר E-APPROVAL-WRITE-FAILED', response.error.code, 'E-APPROVAL-WRITE-FAILED');
  check('והמסלול נשאר פתוח', repository.getSite('s-1').status, 'open');
  check('ו-corpus_version לא התקדם', repository.getSite('s-1').corpus_version, null);
}

// --- L6: נעילה שנייה מקדמת את המונה, ועריכה מאפסת את המצב ---

{
  const repository = lockableRepository();
  const handle = create(options(repository));
  handle(lockEnvelope({ site_id: 's-1' }));

  handle(envelope('edit_item', { item_id: 'i-a', text: 'טקסט מתוקן' }, 'screen-content'));
  check('העריכה פתחה את המסלול', repository.getSite('s-1').status, 'open');
  check('והפריט חזר ל-draft', repository.getItem('i-a').status, 'draft');

  // שני תנאים נכשלים, ולא אחד: הפריט חזר ל-draft (L1), ואיתו
  // התחנה שלו איבדה את הפריט המאושר היחיד שלה (L2).
  check('נעילה מחדש דורשת את התנאים מחדש',
    handle(lockEnvelope({ site_id: 's-1' })).error.data.failed, ['L1', 'L2']);

  // הפריט חוזר במסלול המלא: הגשה, אישור, ואז נעילה שנייה.
  handle(envelope('submit', { item_id: 'i-a' }, 'screen-veto'));
  handle(envelope('approve', { item_id: 'i-a' }, 'screen-veto'));
  const second = handle(lockEnvelope({ site_id: 's-1' }));

  check('הנעילה השנייה מצליחה', second.ok, true);
  check('ו-corpus_version התקדם ל-2', repository.getSite('s-1').corpus_version, 2);
}

{
  const handle = create(options(lockableRepository()));
  check('נעילת מסלול שאינו קיים נדחית',
    handle(lockEnvelope({ site_id: 's-9' })).error.code, 'E-LOCK-REFUSED');
}

// --- ההיקף: המודול שלם מול מפה 4.2 ---

{
  const repository = fakeRepository();
  const handle = create(options(repository));
  const actions = [
    'submit', 'approve', 'reject', 'return',
    'register_mou', 'register_institute', 'register_source',
    'create_item', 'edit_item', 'verify_anchor', 'register_exit_point', 'lock_site',
    'listApprovedByStop', 'nearestExitPoint',
    'listItems', 'getItem', 'listApprovals', 'getSite', 'listSources',
    'listInstitutes', 'listMou', 'listExitPoints',
  ];
  // הפעולה עשויה להיכשל עסקית, ואסור לה לזרוק: זריקה פירושה
  // E-MODULE-FAILED, כלומר פעולה שלא נבנתה.
  const notBuilt = actions.filter((action) => {
    try {
      handle(envelope(action, { site_id: 's-1', item_id: 'i-draft' }, 'screen-content'));
      return false;
    } catch {
      return true;
    }
  });
  check('כל עשרים ושתיים הפעולות של 4.2 מיושמות', notBuilt, []);
  checkThrows('ופעולה שאינה במפה נזרקת', () => handle(envelope('לא קיימת', {})));
}

// --- המודול זקוק ל-Repository בהזרקה, ואינו יודע להשיג אותו לבד ---

checkThrows('בלי Repository אין מודול', () => create({}));

report();
