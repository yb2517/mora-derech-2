// Unit של BE-06, Gate Enforcement. נגזר מבדיקת הקבלה של משימה 4
// בתוכנית שלב 3, מ-usecase-f-07 צעדים 10 ו-14, מ-BL-08 ומ-BL-12,
// ומשורת BE-06 במפה 6.1 ("M-06 = 0, enforce = true: שער חסום;
// הקריטריון: M-06 נקרא מרשומה").
//
//   node tests/unit/gate.test.js

import { create } from '../../services/gate.js';
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, report } = createChecker('BE-06 gate');

const NOW = '2026-09-14T12:00:00.000Z';

// שני מקורות למסלול, ופריט מאושר לכל אחד: הכיסוי נמדד מול המקורות
// שפריטי ה-approved של המסלול מפנים אליהם (הכרעה 17 בתוכנית שלב 4).
function fakeRepository({
  mou = [], siteStatus = 'open', enforce = false, sources = ['src-1', 'src-2'], items,
  anchors, approvals,
} = {}) {
  const rows = items ?? sources.map((sourceId, index) => ({
    item_id: `item-${index + 1}`, site_id: 's-1', stop_id: 'stop-1',
    source_id: sourceId, status: 'approved', text: 'טקסט', page: index + 1,
  }));
  const anchorRows = anchors ?? rows.map((row) => ({
    anchor_id: `anch-${row.item_id}`, item_id: row.item_id, verified: true, is_crossing: false,
  }));
  const approvalRows = approvals ?? rows.map((row) => ({
    approval_id: `appr-${row.item_id}`, target: row.item_id, action: 'approve', to_status: 'approved',
  }));
  const reference = { enforce_gate_b: enforce };
  return {
    reference,
    getRef: (key) => reference[key],
    setRef: (key, value) => { reference[key] = value; return value; },
    getSite: () => ({
      site_id: 's-1', name: 'מסלול', status: siteStatus, stops: ['stop-1'], corpus_version: null,
    }),
    listItems: () => rows.map((row) => ({ ...row })),
    listAnchors: () => anchorRows.map((row) => ({ ...row })),
    listApprovals: () => approvalRows.map((row) => ({ ...row })),
    listSources: () => sources.map((source_id) => ({ source_id })),
    listMou: () => mou.map((row) => ({ ...row })),
  };
}

const askGate = (repository) => create({ repository, now: () => NOW })({
  from: 'screen-veto', module: 'BE-06', action: 'get_gate', payload: {}, lang: 'he',
});

const validMou = {
  mou_id: 'mou-1',
  institute_id: 'inst-1',
  scope: ['src-1', 'src-2'],
  signed_at: '2026-09-01T00:00:00.000Z',
  valid_until: '2027-09-01T00:00:00.000Z',
};

// --- M-06 נספר מרשומה ---

{
  const response = askGate(fakeRepository({ mou: [validMou] }));
  check('התשובה מוצלחת', response.ok, true);
  check('M-06 = 1 כשיש הסכם בתוקף שמכסה את כל המקורות', response.data.coverage.m06, 1);
  check('והמכון המכסה מזוהה', response.data.coverage.institutes, ['inst-1']);
  check('המקורות הנדרשים', response.data.coverage.required, ['src-1', 'src-2']);
}

{
  // בדיקת הקבלה של המשימה: מסירים מקור אחד מההיקף.
  const partial = { ...validMou, scope: ['src-1'] };
  check('כיסוי חלקי אינו נספר', askGate(fakeRepository({ mou: [partial] })).data.coverage.m06, 0);
}

{
  const expired = { ...validMou, valid_until: '2026-01-01T00:00:00.000Z' };
  check('הסכם שפג תוקפו אינו נספר', askGate(fakeRepository({ mou: [expired] })).data.coverage.m06, 0);
  check('והוא גם אינו נספר כהסכם בתוקף', askGate(fakeRepository({ mou: [expired] })).data.coverage.mou_in_effect, 0);
}

{
  const undated = { ...validMou, valid_until: null };
  check('הסכם בלי תאריך תוקף אינו נספר', askGate(fakeRepository({ mou: [undated] })).data.coverage.m06, 0);
}

{
  const second = { ...validMou, mou_id: 'mou-2', institute_id: 'inst-2' };
  check('שני מכונים מכסים: M-06 = 2', askGate(fakeRepository({ mou: [validMou, second] })).data.coverage.m06, 2);

  const sameInstitute = { ...validMou, mou_id: 'mou-3' };
  check(
    'שני הסכמים של אותו מכון נספרים כמכון אחד',
    askGate(fakeRepository({ mou: [validMou, sameInstitute] })).data.coverage.m06,
    1,
  );
}

{
  check('בלי הסכמים כלל: M-06 = 0', askGate(fakeRepository({ mou: [] })).data.coverage.m06, 0);
  check(
    'מסלול בלי מקורות אינו מייצר כיסוי',
    askGate(fakeRepository({ mou: [validMou], sources: [] })).data.coverage.m06,
    0,
  );
}

// --- הכרעה 17: הבסיס הוא פריטי ה-approved ---

{
  // מקור שרק פריט draft מפנה אליו אינו נדרש בכיסוי. זה מה שהכרעת
  // בעלת הפרויקט שינתה מול שלב 3, וזה מה ש-L4 של F-08 מודד.
  const items = [
    { item_id: 'item-1', site_id: 's-1', stop_id: 'stop-1', source_id: 'src-1', status: 'approved' },
    { item_id: 'item-2', site_id: 's-1', stop_id: 'stop-1', source_id: 'src-2', status: 'draft' },
  ];
  const response = askGate(fakeRepository({ mou: [{ ...validMou, scope: ['src-1'] }], items }));
  check('מקור של פריט draft אינו נדרש', response.data.coverage.required, ['src-1']);
  check('ולכן הכיסוי מלא', response.data.coverage.m06, 1);
  check('ואין מקור לא מכוסה', response.data.coverage.uncovered, []);
}

{
  // הצד השני: מקור של פריט approved שאף הסכם בתוקף אינו מכסה חוזר
  // בשם, כדי ש-L4 יוכל לומר מה חסר.
  const response = askGate(fakeRepository({ mou: [{ ...validMou, scope: ['src-1'] }] }));
  check('מקור לא מכוסה חוזר בשמו', response.data.coverage.uncovered, ['src-2']);
}

{
  // מסלול שכל פריטיו pending: אין מה לכסות, ולכן אין כיסוי.
  const items = [
    { item_id: 'item-1', site_id: 's-1', stop_id: 'stop-1', source_id: 'src-1', status: 'pending' },
  ];
  check(
    'מסלול בלי פריט מאושר אינו מייצר כיסוי',
    askGate(fakeRepository({ mou: [validMou], items })).data.coverage.m06,
    0,
  );
}

// --- BL-08: מצב השער ---

{
  const open = askGate(fakeRepository({ mou: [validMou], siteStatus: 'locked', enforce: true }));
  check('מסלול נעול ו-M-06 = 1: השער פתוח', open.data.gate.open, true);
  check('ואינו חוסם', open.data.gate.blocking, false);
}

{
  // שורת BE-06 במפה 6.1.
  const blocked = askGate(fakeRepository({ mou: [], siteStatus: 'locked', enforce: true }));
  check('M-06 = 0 ואכיפה דולקת: חסום', blocked.data.gate.open, false);
  check('והחסימה בתוקף', blocked.data.gate.blocking, true);
  check('הסיבה מוחזרת למסך', blocked.data.gate.reasons, ['m06_zero']);
}

{
  // פער 34: בסוף שלב 3 זהו המצב בפועל. ההסכם נרשם, M-06 = 1,
  // והשער נשאר חסום מפני שהמסלול אינו נעול. הנעילה היא F-08.
  const registered = askGate(fakeRepository({ mou: [validMou], siteStatus: 'open', enforce: true }));
  check('הסכם נרשם והמסלול פתוח: M-06 = 1', registered.data.coverage.m06, 1);
  check('והשער עדיין חסום', registered.data.gate.open, false);
  check('והסיבה היחידה היא הנעילה', registered.data.gate.reasons, ['site_not_locked']);
}

{
  // זרימה ו3: אכיפה כבויה, המצב מוצג ואינו נאכף.
  const soft = askGate(fakeRepository({ mou: [], enforce: false }));
  check('אכיפה כבויה: אינו חוסם', soft.data.gate.blocking, false);
  check('אבל המצב מוצג כחסום', soft.data.gate.open, false);
  check('והמסך יודע שהאכיפה כבויה', soft.data.gate.enforced, false);
}

// --- BL-12 וחוק ברזל 5: ערך חסר אינו מומצא ---

{
  const repository = { ...fakeRepository(), getRef: () => undefined };
  const response = askGate(repository);
  check('מפתח חסר מחזיר E-REF-EMPTY', response.error.code, 'E-REF-EMPTY');
  check('ו-error.data נושא את שם ההגדרה', response.error.data.key, 'enforce_gate_b');
}

{
  const repository = { ...fakeRepository(), getRef: () => null };
  check('מפתח בלי ערך מוכרע מחזיר אותו דבר', askGate(repository).error.code, 'E-REF-EMPTY');
}

// ---------------------------------------------------------------------
// משימה 5 בתוכנית שלב 4: המודול שלם
// ---------------------------------------------------------------------

const ownerEnvelope = (action, payload = {}) => ({
  from: 'screen-owner', module: 'BE-06', action, payload, lang: 'he',
});

// --- get_lock_readiness, usecase-f-08 צעד 9 ---

{
  const handle = create({ repository: fakeRepository({ mou: [validMou] }), now: () => NOW });
  const response = handle(ownerEnvelope('get_lock_readiness', { site_id: 's-1' }));

  check('התשובה מוצלחת', response.ok, true);
  check('ארבעת התנאים מוחזרים', response.data.readiness.conditions.map((row) => row.id), ['L1', 'L2', 'L3', 'L4']);
  check('מסלול מוכן', response.data.readiness.ready, true);
  check('והמסלול מוחזר עם התשובה', response.data.site.site_id, 's-1');
}

{
  // אותה פונקציה שרצה בתוך lock_site: תחנה בלי מאושר מכשילה את L2.
  const repository = fakeRepository({
    mou: [validMou],
    items: [{ item_id: 'item-1', site_id: 's-1', stop_id: 'stop-9', source_id: 'src-1', status: 'approved', text: 'טקסט', page: 1 }],
  });
  const response = create({ repository, now: () => NOW })(ownerEnvelope('get_lock_readiness', {}));

  check('תחנה בלי פריט מאושר מכשילה', response.data.readiness.ready, false);
  check('והתנאי שנכשל מדווח', response.data.readiness.failed, ['L2']);
  check('והתחנה חוזרת בשמה',
    response.data.readiness.conditions.find((row) => row.id === 'L2').failing, ['stop-1']);
}

{
  const repository = fakeRepository({ mou: [validMou], approvals: [] });
  const response = create({ repository, now: () => NOW })(ownerEnvelope('get_lock_readiness', {}));
  check('פריט מאושר בלי רשומה מכשיל את L1', response.data.readiness.failed, ['L1']);
}

{
  // מפה 3.2, שורת BE-06: "כותב: אין". גם טבלת המוכנות אינה כותבת.
  const repository = fakeRepository({ mou: [validMou] });
  for (const name of ['setStatus', 'appendApproval', 'updateSite', 'setRef']) {
    repository[name] = () => { throw new Error(`BE-06 כתב ב-${name}`); };
  }
  check('טבלת המוכנות אינה כותבת דבר',
    create({ repository, now: () => NOW })(ownerEnvelope('get_lock_readiness', {})).ok, true);
}

// --- set_enforce, usecase-f-07 זרימה ו ---

{
  const repository = fakeRepository({ enforce: false });
  const handle = create({ repository, now: () => NOW });

  const on = handle(ownerEnvelope('set_enforce', {}));
  check('המתג מדליק', on.data.enforce, true);
  check('והערך הקודם מדווח', on.data.was, false);
  check('והערך נכתב לטבלה', repository.reference.enforce_gate_b, true);

  check('וכיבוי מחזיר אותו', handle(ownerEnvelope('set_enforce', {})).data.enforce, false);
  check('ערך מפורש גובר', handle(ownerEnvelope('set_enforce', { enforce: true })).data.enforce, true);
  check('ושליחה חוזרת של אותו ערך אינה משנה',
    handle(ownerEnvelope('set_enforce', { enforce: true })).data.enforce, true);
}

{
  const repository = { ...fakeRepository(), getRef: () => undefined };
  check('מפתח חסר אינו נכתב אלא מוחזר כשגיאה',
    create({ repository, now: () => NOW })(ownerEnvelope('set_enforce', {})).error.code, 'E-REF-EMPTY');
}

{
  // אחרי הדלקת האכיפה, השער מדווח שהוא אוכף.
  const repository = fakeRepository({ mou: [], enforce: false });
  const handle = create({ repository, now: () => NOW });
  check('לפני: אינו אוכף', handle(ownerEnvelope('get_gate', {})).data.gate.enforced, false);
  handle(ownerEnvelope('set_enforce', {}));
  check('אחרי: אוכף', handle(ownerEnvelope('get_gate', {})).data.gate.enforced, true);
  check('וחוסם', handle(ownerEnvelope('get_gate', {})).data.gate.blocking, true);
}

// --- השער נפתח כשהמסלול נעול ו-M-06 אחד לפחות (BL-08) ---

{
  const handle = create({
    repository: fakeRepository({ mou: [validMou], siteStatus: 'locked', enforce: true }),
    now: () => NOW,
  });
  const response = handle(ownerEnvelope('get_gate', {}));
  check('מסלול נעול והסכם בתוקף: השער פתוח', response.data.gate.open, true);
  check('ואין סיבות חוסמות', response.data.gate.reasons, []);
}

// --- ההיקף: שלוש הפעולות של 4.2 מיושמות ---

{
  const handle = create({ repository: fakeRepository(), now: () => NOW });
  const notBuilt = ['get_gate', 'get_lock_readiness', 'set_enforce'].filter((action) => {
    try { handle(ownerEnvelope(action, {})); return false; } catch { return true; }
  });
  check('שלוש הפעולות מיושמות', notBuilt, []);
  checkThrows('ופעולה שאינה במפה נזרקת', () => handle(ownerEnvelope('לא קיימת')));
}

checkThrows('בלי Repository אין מודול', () => create({}));

// --- מה שהמודול אינו עושה ---

{
  // מפה 3.2, שורת BE-06: "כותב: אין". הבדיקה מזריקה Repository
  // שנופל בכל כתיבה, וקוראת את השער.
  const repository = fakeRepository({ mou: [validMou] });
  for (const name of ['setStatus', 'appendApproval', 'appendMou', 'appendInstitute', 'appendSource']) {
    repository[name] = () => { throw new Error(`BE-06 כתב ב-${name}`); };
  }
  check('קריאת השער אינה כותבת דבר', askGate(repository).ok, true);
}

report();
