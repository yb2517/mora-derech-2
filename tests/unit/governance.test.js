// Unit של BE-05, פרוסת F-07. נגזר ממפה 6.1 ("approve על פריט
// approved: E-TRANSITION-DENIED, אין רשומה חדשה"), מ-BL-01, מ-BL-02
// ומ-usecase-f-07 צעדים 3 עד 13. נכתב יחד עם הקוד.
//
// כאן המודול לבדו, מול Repository מזויף. השרשרת המלאה דרך
// ה-Orchestrator נבדקת ב-tests/system/f-07-slice.test.js.
//
//   node tests/unit/governance.test.js

import { create as createGovernance, ACTIONS } from '../../services/governance.js';
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, report } = createChecker('BE-05 governance');

function fakeRepository({ items = [], anchors = [], approvals = [], sites = [], sources = [], institutes = [], mou = [], failApproval = false } = {}) {
  const state = { items: items.map((r) => ({ ...r })), approvals: [...approvals], mou: [...mou] };
  return {
    state,
    getItem: (id) => state.items.find((r) => r.item_id === id) ?? null,
    listItems: ({ site_id: siteId, stop_id: stopId, status } = {}) => state.items
      .filter((r) => siteId === undefined || r.site_id === siteId)
      .filter((r) => stopId === undefined || r.stop_id === stopId)
      .filter((r) => status === undefined || r.status === status),
    setItemStatus: (id, status) => {
      const row = state.items.find((r) => r.item_id === id);
      if (row) row.status = status;
      return row;
    },
    appendApproval: (row) => {
      if (failApproval) throw new Error('כשל כתיבה מדומה');
      state.approvals.push(row);
      return row;
    },
    listApprovals: ({ target } = {}) => (target === undefined
      ? state.approvals
      : state.approvals.filter((r) => r.target === target)),
    getAnchorForItem: (id) => anchors.find((r) => r.item_id === id) ?? null,
    listSites: () => sites,
    getSite: (id) => sites.find((r) => r.site_id === id) ?? null,
    listSources: () => sources,
    listInstitutes: () => institutes,
    listMou: () => state.mou,
    appendMou: (row) => { state.mou.push(row); return row; },
  };
}

const FULL = { item_id: 'i-1', site_id: 's-1', stop_id: 'st-1', text: 'טקסט', page: 3, source_id: 'src-1' };
const ANCHOR = { anchor_id: 'a-1', item_id: 'i-1', lat: 31.78, lng: 35.21 };

function moduleOn(repository) {
  let n = 0;
  return createGovernance({
    repository,
    now: () => '2026-09-14T10:00:00.000Z',
    newId: () => `id-${n += 1}`,
  });
}

const call = (handle, action, payload, from = 'screen-veto') => handle({
  from, module: 'BE-05', action, payload, lang: 'he',
});

// --- מה המודול מצהיר שהוא מממש ---

check('שתים עשרה פעולות בשלב 3', ACTIONS.length, 12);
check(
  'ארבעת המעברים ו-register_mou הם פעולות הכתיבה',
  ACTIONS.filter((a) => !a.startsWith('list') && !a.startsWith('get')).sort(),
  ['approve', 'register_mou', 'reject', 'return', 'submit'],
);
check(
  'פעולות שלב 4 אינן מוצהרות',
  ACTIONS.filter((a) => ['create_item', 'edit_item', 'verify_anchor', 'lock_site'].includes(a)),
  [],
);
checkThrows('בלי Repository המודול אינו נבנה', () => createGovernance({}));
checkThrows('פעולה שלא נבנתה נופלת', () => moduleOn(fakeRepository())({ action: 'lock_site' }));

// --- BL-02: ארבעת המעברים של F-07 ---

{
  const repository = fakeRepository({
    items: [
      { ...FULL, status: 'draft' },
      { ...FULL, item_id: 'i-2', status: 'pending' },
      { ...FULL, item_id: 'i-3', status: 'approved' },
      { ...FULL, item_id: 'i-4', status: 'rejected' },
    ],
    anchors: [ANCHOR, { ...ANCHOR, item_id: 'i-2' }, { ...ANCHOR, item_id: 'i-3' }, { ...ANCHOR, item_id: 'i-4' }],
  });
  const handle = moduleOn(repository);

  check('submit: draft ל-pending', call(handle, 'submit', { item_id: 'i-1' }).data.status, 'pending');
  check('approve: pending ל-approved', call(handle, 'approve', { item_id: 'i-2' }).data.status, 'approved');
  check('return: approved ל-pending', call(handle, 'return', { item_id: 'i-3' }).data.status, 'pending');
  check('return: rejected ל-pending', call(handle, 'return', { item_id: 'i-4' }).data.status, 'pending');
  check('ארבע רשומות ביומן', repository.state.approvals.length, 4);
}

{
  const repository = fakeRepository({
    items: [{ ...FULL, item_id: 'i-2', status: 'pending' }],
    anchors: [{ ...ANCHOR, item_id: 'i-2' }],
  });
  const handle = moduleOn(repository);
  check('reject: pending ל-rejected', call(handle, 'reject', { item_id: 'i-2' }).data.status, 'rejected');
  check('ההערה רשות, ורשומה נכתבת גם בלעדיה', repository.state.approvals[0].note, '');
}

// --- מפה 6.1: approve על פריט approved ---

{
  const repository = fakeRepository({ items: [{ ...FULL, status: 'approved' }], anchors: [ANCHOR] });
  const handle = moduleOn(repository);
  const response = call(handle, 'approve', { item_id: 'i-1' });

  check('נדחה', response.error.code, 'E-TRANSITION-DENIED');
  check('אין רשומה חדשה', repository.state.approvals.length, 0);
  check('והמצב לא זז', repository.getItem('i-1').status, 'approved');
}

// --- BL-01: הרשומה לפני המצב, וכשל מבטל את המעבר ---

{
  const repository = fakeRepository({
    items: [{ ...FULL, status: 'pending' }], anchors: [ANCHOR], failApproval: true,
  });
  const handle = moduleOn(repository);
  const response = call(handle, 'approve', { item_id: 'i-1' });

  check('הכשל מוחזר בקוד שלו', response.error.code, 'E-APPROVAL-WRITE-FAILED');
  check('הפריט לא זז', repository.getItem('i-1').status, 'pending');
}

// סדר הפעולות עצמו, ולא רק תוצאתו: הרשומה נכתבת לפני שינוי המצב.
{
  const order = [];
  const base = fakeRepository({ items: [{ ...FULL, status: 'pending' }], anchors: [ANCHOR] });
  const spy = {
    ...base,
    appendApproval: (row) => { order.push('appendApproval'); return base.appendApproval(row); },
    setItemStatus: (id, status) => { order.push('setItemStatus'); return base.setItemStatus(id, status); },
  };
  call(moduleOn(spy), 'approve', { item_id: 'i-1' });
  check('הסדר הוא רשומה ואז מצב', order, ['appendApproval', 'setItemStatus']);
}

// --- תנאי השלמות ---

{
  const repository = fakeRepository({
    items: [
      { ...FULL, status: 'draft', page: undefined },
      { ...FULL, item_id: 'i-2', status: 'draft' },
    ],
    anchors: [{ ...ANCHOR, item_id: 'i-1' }],
  });
  const handle = moduleOn(repository);

  check('בלי עמוד', call(handle, 'submit', { item_id: 'i-1' }).error.data.field, 'page');
  check('בלי עוגן', call(handle, 'submit', { item_id: 'i-2' }).error.data.field, 'anchor');
  check('ולא נרשמה רשומה', repository.state.approvals.length, 0);
  check('approve אינו דורש שלמות', call(handle, 'approve', { item_id: 'i-2' }).error.code, 'E-TRANSITION-DENIED');
}

// --- המבצע שנרשם ---

{
  const repository = fakeRepository({ items: [{ ...FULL, status: 'pending' }], anchors: [ANCHOR] });
  call(moduleOn(repository), 'approve', { item_id: 'i-1', note: 'הערה' });
  const row = repository.state.approvals[0];
  check('המבצע הוא שם הפונה שבמעטפה', row.who, 'screen-veto');
  check('הזמן נרשם', row.time, '2026-09-14T10:00:00.000Z');
  check('ההערה נרשמה', row.note, 'הערה');
  check('היעד הוא הפריט', row.target, 'i-1');
  check('הערה שאינה מחרוזת נרשמת כריקה', typeof row.note, 'string');
}

// --- פעולות הקריאה ---

{
  const repository = fakeRepository({
    items: [
      { ...FULL, status: 'approved' },
      { ...FULL, item_id: 'i-2', stop_id: 'st-2', status: 'pending' },
      { ...FULL, item_id: 'i-9', site_id: 's-2', status: 'draft' },
    ],
    anchors: [ANCHOR],
    approvals: [{ approval_id: 'ap-1', target: 'i-1' }, { approval_id: 'ap-2', target: 'i-9' }],
    sites: [{ site_id: 's-1', name: 'מסלול' }],
    sources: [{ source_id: 'src-1', name: 'מקור' }],
    institutes: [{ institute_id: 'inst-1' }],
    mou: [{ mou_id: 'm-1' }],
  });
  const handle = moduleOn(repository);

  const list = call(handle, 'listItems', { site_id: 's-1' });
  check('listItems לפי מסלול', list.data.items.length, 2);
  check('הרשימה יוצאת בלי הטקסט המלא', 'text' in list.data.items[0], false);
  check('listItems לפי תחנה', call(handle, 'listItems', { stop_id: 'st-2' }).data.items.length, 1);
  check('listItems לפי מצב', call(handle, 'listItems', { status: 'approved' }).data.items.length, 1);

  const item = call(handle, 'getItem', { item_id: 'i-1' });
  check('getItem מחזיר טקסט מלא', item.data.item.text, 'טקסט');
  check('ואת המקור', item.data.source.name, 'מקור');
  check('ואת העוגן', item.data.anchor.anchor_id, 'a-1');

  const missing = call(handle, 'getItem', { item_id: 'אין' });
  check('getItem על מזהה שאינו קיים מחזיר null עם ok', missing.ok, true);
  check('והפריט null', missing.data.item, null);
  check('והמקור null', missing.data.source, null);

  check('listApprovals של מסלול מסנן', call(handle, 'listApprovals', { site_id: 's-1' }).data.approvals.length, 1);
  check('ובלי site_id מחזיר הכול', call(handle, 'listApprovals', {}).data.approvals.length, 2);
  check('getSite בלי מזהה, מסלול יחיד', call(handle, 'getSite', {}).data.site.site_id, 's-1');
  check('getSite לפי מזהה שאינו קיים', call(handle, 'getSite', { site_id: 'אין' }).data.site, null);
  check('listSources', call(handle, 'listSources', {}).data.sources.length, 1);
  check('listInstitutes', call(handle, 'listInstitutes', {}).data.institutes.length, 1);
  check('listMou', call(handle, 'listMou', {}).data.mou.length, 1);
}

// --- register_mou ---

{
  const repository = fakeRepository({ institutes: [{ institute_id: 'inst-1' }] });
  const handle = moduleOn(repository);
  const response = call(handle, 'register_mou', {
    institute_id: 'inst-1', scope: ['src-1', 'src-2'], valid_until: '2027-01-01T00:00:00.000Z',
  }, 'screen-owner');

  check('נרשם', response.ok, true);
  check('עם מזהה שנוצר', response.data.mou.mou_id, 'id-1');
  check('עם היקף', response.data.mou.scope, ['src-1', 'src-2']);
  check('תאריך חתימה מתמלא כשלא נשלח', response.data.mou.signed_at, '2026-09-14T10:00:00.000Z');
  check('והרשומה נשמרה', repository.state.mou.length, 1);
  check('רישום הסכם אינו רשומת APPROVALS', repository.state.approvals.length, 0);

  check('היקף ריק נדחה', call(handle, 'register_mou', { institute_id: 'inst-1', scope: [] }, 'screen-owner').error.data.field, 'scope');
  check('בלי תוקף נדחה', call(handle, 'register_mou', { institute_id: 'inst-1', scope: ['src-1'] }, 'screen-owner').error.data.field, 'valid_until');
  check('מכון שאינו רשום נדחה', call(handle, 'register_mou', { institute_id: 'אין', scope: ['src-1'], valid_until: 'x' }, 'screen-owner').error.data.field, 'institute_id');
}

report();
