// Unit של BE-06. נגזר ממפה 6.1 ("M-06 = 0, enforce = true: שער חסום,
// M-06 נקרא מרשומה"), מ-BL-08, מ-usecase-f-07 צעד 14 ומ-L4 של
// usecase-f-08. נכתב יחד עם הקוד.
//
//   node tests/unit/gate.test.js

import { create as createGate } from '../../services/gate.js';
import { ACTIONS } from '../../services/gate.js';
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, report } = createChecker('BE-06 gate');

// Repository מזויף: המודול תלוי בממשק ולא במימוש, ולכן אפשר לבדוק
// אותו בלי דרייבר, בלי אחסון ובלי Orchestrator.
function fakeRepository({ items = [], mou = [], sites = [], ref = { enforce_gate_b: false } } = {}) {
  return {
    getRef: (key) => ref[key],
    listSites: () => sites,
    getSite: (id) => sites.find((s) => s.site_id === id) ?? null,
    listItems: ({ site_id: siteId, status } = {}) => items
      .filter((i) => siteId === undefined || i.site_id === siteId)
      .filter((i) => status === undefined || i.status === status),
    listMou: () => mou,
  };
}

const SITE_OPEN = { site_id: 's-1', status: 'open' };
const SITE_LOCKED = { site_id: 's-1', status: 'locked' };
const APPROVED = { item_id: 'i-1', site_id: 's-1', status: 'approved', source_id: 'src-1' };
const PENDING = { item_id: 'i-2', site_id: 's-1', status: 'pending', source_id: 'src-2' };
const VALID_MOU = { mou_id: 'm-1', institute_id: 'inst-1', scope: ['src-1'], valid_until: '2027-01-01T00:00:00.000Z' };

const NOW = () => '2026-09-14T10:00:00.000Z';

const ask = (repository, payload = {}) => createGate({ repository, now: NOW })({
  from: 'screen-veto', module: 'BE-06', action: 'get_gate', payload, lang: 'he',
});

check('המודול מצהיר על פעולה אחת בלבד בשלב הזה', [...ACTIONS], ['get_gate']);
checkThrows('בלי Repository הוא אינו נבנה', () => createGate({}));

// --- מפה 6.1: M-06 = 0 ו-enforce דולק, השער חסום ---

{
  const response = ask(fakeRepository({
    sites: [SITE_OPEN], items: [APPROVED], mou: [], ref: { enforce_gate_b: true },
  }));
  check('M-06 אפס', response.data.gate.m06, 0);
  check('השער אינו פתוח', response.data.gate.open, false);
  check('והאכיפה דולקת, ולכן הוא חוסם', response.data.gate.blocking, true);
}

// --- אכיפה כבויה: המצב מוצג ואינו נאכף (BL-08) ---

{
  const response = ask(fakeRepository({
    sites: [SITE_OPEN], items: [APPROVED], mou: [], ref: { enforce_gate_b: false },
  }));
  check('השער עדיין אינו פתוח', response.data.gate.open, false);
  check('אבל אינו חוסם', response.data.gate.blocking, false);
  check('והמסך יודע שהאכיפה כבויה', response.data.gate.enforced, false);
}

// --- BL-08: פתוח כאשר locked וגם M-06 גדול או שווה 1 ---

{
  const locked = ask(fakeRepository({ sites: [SITE_LOCKED], items: [APPROVED], mou: [VALID_MOU] }));
  check('מסלול נעול והסכם מכסה: השער פתוח', locked.data.gate.open, true);
  check('M-06 אחד', locked.data.gate.m06, 1);

  const openSite = ask(fakeRepository({ sites: [SITE_OPEN], items: [APPROVED], mou: [VALID_MOU] }));
  check('אותו הסכם ומסלול פתוח: השער אינו פתוח', openSite.data.gate.open, false);
  check('אבל M-06 עדיין אחד', openSite.data.gate.m06, 1);

  const lockedNoMou = ask(fakeRepository({ sites: [SITE_LOCKED], items: [APPROVED], mou: [] }));
  check('מסלול נעול בלי הסכם: השער אינו פתוח', lockedNoMou.data.gate.open, false);
}

// --- M-06 מרשומות: כיסוי, תוקף, וספירת מכונים ---

{
  const partial = ask(fakeRepository({
    sites: [SITE_LOCKED],
    items: [APPROVED, { ...PENDING, status: 'approved' }],
    mou: [VALID_MOU],
  }));
  check('הסכם שמכסה מקור אחד מתוך שניים אינו נספר', partial.data.gate.m06, 0);
  check('ושני המקורות מדווחים', partial.data.sources_of_approved, ['src-1', 'src-2']);

  const expired = ask(fakeRepository({
    sites: [SITE_LOCKED], items: [APPROVED],
    mou: [{ ...VALID_MOU, valid_until: '2020-01-01T00:00:00.000Z' }],
  }));
  check('הסכם שפג אינו נספר', expired.data.gate.m06, 0);

  const noDate = ask(fakeRepository({
    sites: [SITE_LOCKED], items: [APPROVED], mou: [{ ...VALID_MOU, valid_until: undefined }],
  }));
  check('הסכם בלי תאריך תוקף אינו נספר', noDate.data.gate.m06, 0);

  const two = ask(fakeRepository({
    sites: [SITE_LOCKED], items: [APPROVED],
    mou: [VALID_MOU, { ...VALID_MOU, mou_id: 'm-2', institute_id: 'inst-2' }],
  }));
  check('שני מכונים מכסים: M-06 שתיים', two.data.gate.m06, 2);

  const twice = ask(fakeRepository({
    sites: [SITE_LOCKED], items: [APPROVED],
    mou: [VALID_MOU, { ...VALID_MOU, mou_id: 'm-3' }],
  }));
  check('אותו מכון עם שני הסכמים נספר פעם אחת', twice.data.gate.m06, 1);
}

// --- הפריטים שאינם approved אינם קובעים כיסוי (L4) ---

{
  const response = ask(fakeRepository({
    sites: [SITE_LOCKED], items: [APPROVED, PENDING], mou: [VALID_MOU],
  }));
  check('מקור של פריט pending אינו נדרש לכיסוי', response.data.gate.m06, 1);
  check('הספירות מונות את שניהם', response.data.counts, { draft: 0, pending: 1, approved: 1, rejected: 0 });
  check('והסך הכול', response.data.total, 2);
}

// --- אין פריט approved: אין מה לכסות, ולכן אפס ---
//
// המסמכים אינם מכריעים את המקרה הזה. ההנחה כאן היא שכיסוי ריק אינו
// כיסוי, והיא מדווחת בדוח השלב.

{
  const response = ask(fakeRepository({ sites: [SITE_LOCKED], items: [PENDING], mou: [VALID_MOU] }));
  check('מסלול בלי פריט מאושר: M-06 אפס', response.data.gate.m06, 0);
  check('והשער אינו פתוח', response.data.gate.open, false);
}

// --- BL-12 וחוק ברזל 5: ערך חסר אינו מומצא ---

{
  const response = ask(fakeRepository({ sites: [SITE_OPEN], ref: {} }));
  check('enforce_gate_b חסר מחזיר E-REF-EMPTY', response.error.code, 'E-REF-EMPTY');
  check('עם שם המפתח', response.error.data.key, 'enforce_gate_b');
  check('ואין נתונים בתשובה', response.ok, false);

  const nulled = ask(fakeRepository({ sites: [SITE_OPEN], ref: { enforce_gate_b: null } }));
  check('מפתח שקיים בלי ערך מוכרע, אותו קוד', nulled.error.code, 'E-REF-EMPTY');
}

// --- בחירת המסלול ---

{
  const single = ask(fakeRepository({ sites: [SITE_OPEN], items: [APPROVED] }));
  check('בלי site_id מוחזר המסלול היחיד', single.data.site.site_id, 's-1');

  const many = ask(fakeRepository({ sites: [SITE_OPEN, { site_id: 's-2', status: 'open' }] }));
  check('שני מסלולים בלי site_id: null, ולא בחירה שרירותית', many.data.site, null);
  check('ואז M-06 אפס', many.data.gate.m06, 0);

  const byId = ask(fakeRepository({ sites: [SITE_OPEN], items: [APPROVED] }), { site_id: 's-9' });
  check('site_id שאינו קיים מחזיר null ולא קוד שגיאה', byId.data.site, null);
}

// --- פעולה שלא נבנתה נופלת, וה-Orchestrator הופך אותה ל-E-MODULE-FAILED ---

checkThrows('get_lock_readiness אינו מיושם בשלב הזה', () => createGate({
  repository: fakeRepository(),
})({ action: 'get_lock_readiness' }));

report();
