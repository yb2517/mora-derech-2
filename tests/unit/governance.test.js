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
function fakeRepository({ failApprovals = false, failStatus = false } = {}) {
  const data = {
    items: [
      { item_id: 'i-draft', site_id: 's-1', stop_id: 'st-1', status: 'draft', source_id: 'src-1', text: 'טקסט' },
      { item_id: 'i-pending', site_id: 's-1', stop_id: 'st-1', status: 'pending', source_id: 'src-1', text: 'טקסט' },
      { item_id: 'i-approved', site_id: 's-1', stop_id: 'st-2', status: 'approved', source_id: 'src-2', text: 'טקסט' },
      { item_id: 'i-rejected', site_id: 's-1', stop_id: 'st-2', status: 'rejected', source_id: 'src-2', text: 'טקסט' },
    ],
    approvals: [],
    sites: [{ site_id: 's-1', name: 'מסלול', status: 'open' }],
    sources: [{ source_id: 'src-1', name: 'מקור א' }, { source_id: 'src-2', name: 'מקור ב' }],
    institutes: [{ institute_id: 'inst-1', name: 'מכון' }],
    mou: [],
  };

  return {
    data,
    getItem: (id) => data.items.find((row) => row.item_id === id) ?? null,
    listItems: ({ site_id: siteId, status } = {}) => data.items
      .filter((row) => siteId === undefined || row.site_id === siteId)
      .filter((row) => status === undefined || row.status === status)
      .map((row) => ({ ...row })),
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

const envelope = (action, payload = {}) => ({
  from: 'screen-veto', module: 'BE-05', action, payload, lang: 'he',
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

  // פער 38: usecase-f-07 צעד 6 כותב "עד 200 תווים", ואין למספר הזה
  // מפתח בטבלת ה-reference. הבדיקה מתעדת את ההתנהגות בפועל, שהיא
  // שמירה בלי קיצוץ, ואינה מקבעת גבול שאיש לא הכריע.
  handle(envelope('return', { item_id: 'i-approved', note: 'א'.repeat(250) }));
  check('הערה ארוכה נשמרת כפי שהגיעה', repository.data.approvals[1].note.length, 250);
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

// --- ההיקף: פעולות שלב 4 אינן מתחזות ---

{
  const handle = create(options(fakeRepository()));
  for (const action of ['create_item', 'edit_item', 'verify_anchor', 'lock_site', 'register_exit_point']) {
    checkThrows(`${action} אינו מיושם בשלב הזה`, () => handle(envelope(action, {})));
  }
}

// --- המודול זקוק ל-Repository בהזרקה, ואינו יודע להשיג אותו לבד ---

checkThrows('בלי Repository אין מודול', () => create({}));

report();
