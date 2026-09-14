// BE-06: Gate Enforcement, חישוב M-06 ומצב שער B. משימה 6 בתוכנית שלב 3.
//
// המקור: מפה 3.2 (BE-06), BL-08, 2.4 (enforce_gate_b), usecase-f-07
// צעדים 10 ו-14, ו-usecase-f-08 L4.
//
// **מה השלב הזה מתקן**: מבחן ההחלפה של usecase-f-07 סעיף 8 קובע
// "BE-06: שום דבר יישבר, כל עוד M-06 והספירות נקראים מהנתונים ולא
// מקבוע בקוד", ומוסיף "בבנייה 02 M-06 הוא קבוע, ולכן היום הוא נכשל".
// כאן הוא מפסיק להיכשל: M-06 מחושב מרשומות RIGHTS_MOU, מהמקורות
// ומהפריטים, ואין לו ערך בקוד.
//
// מה נבנה בשלב 3 ומה לא: get_gate בלבד. get_lock_readiness דורש את
// L1 עד L4 (BL-06) ו-set_enforce כותב לטבלת ה-reference, ושניהם
// שלב 4. עד אז ההדגמה עומדת במקומם בהרכבה.

import { error } from '../core/errors.js';

/** הפעולות שהמודול מממש בפועל. ההרכבה קוראת את הרשימה. */
export const ACTIONS = Object.freeze(['get_gate']);

const ok = (data) => ({ ok: true, data });
const fail = (code, data) => ({ ok: false, error: error(code, data) });

const ENFORCE_KEY = 'enforce_gate_b';

function defaultNow() {
  return new Date().toISOString();
}

/**
 * @param {object} options
 * @param {object} options.repository CORE-04.
 * @param {() => string} [options.now] חותמת זמן. מוזרקת בבדיקה.
 */
export function create({ repository, now = defaultNow } = {}) {
  if (!repository) {
    throw new Error('BE-06 זקוק ל-Repository');
  }

  function siteOf(payload) {
    if (payload?.site_id !== undefined) return repository.getSite(payload.site_id);
    const sites = repository.listSites();
    return sites.length === 1 ? sites[0] : null;
  }

  /**
   * M-06: מספר המכונים שיש להם הסכם בתוקף המכסה 100% ממקורות
   * המסלול, לפי usecase-f-07 צעד 14 ו-L4 של usecase-f-08.
   *
   * מקורות המסלול הם המקורות של הפריטים ה-approved שלו, כלשון L4:
   * "לכל מקור של פריט approved קיימת רשומת RIGHTS_MOU בתוקף המכסה
   * אותו". אין פריט approved: אין מקור לכסות, ואין כיסוי להצהיר,
   * ולכן M-06 הוא אפס. המסמכים אינם מכריעים את המקרה הזה, וההנחה
   * מדווחת בדוח השלב.
   */
  function computeM06(site) {
    if (!site) return { m06: 0, sources: [], covering: [] };

    const sources = [...new Set(
      repository
        .listItems({ site_id: site.site_id, status: 'approved' })
        .map((item) => item.source_id)
        .filter((id) => id !== undefined && id !== null && id !== ''),
    )].sort();

    if (sources.length === 0) return { m06: 0, sources, covering: [] };

    const at = now();
    const covering = [...new Set(
      repository
        .listMou()
        .filter((mou) => typeof mou.valid_until === 'string' && mou.valid_until > at)
        .filter((mou) => {
          const scope = new Set(Array.isArray(mou.scope) ? mou.scope : []);
          return sources.every((id) => scope.has(id));
        })
        .map((mou) => mou.institute_id),
    )];

    return { m06: covering.length, sources, covering };
  }

  function getGate(payload) {
    // BL-12 וחוק ברזל 5: הערך נקרא מהטבלה. מפתח בלי ערך מוכרע
    // מחזיר E-REF-EMPTY עם שמו, ואינו מומצא כאן.
    const enforce = repository.getRef(ENFORCE_KEY);
    if (enforce === undefined || enforce === null) {
      return fail('E-REF-EMPTY', { key: ENFORCE_KEY });
    }

    const site = siteOf(payload);
    const { m06, sources, covering } = computeM06(site);

    const items = site ? repository.listItems({ site_id: site.site_id }) : [];
    const counts = items.reduce(
      (tally, item) => ({ ...tally, [item.status]: (tally[item.status] ?? 0) + 1 }),
      { draft: 0, pending: 0, approved: 0, rejected: 0 },
    );

    // BL-08: שער B פתוח כאשר המסלול locked ו-M-06 גדול או שווה 1.
    // כאשר האכיפה כבויה, המצב מוצג ואינו נאכף: open נשאר כפי שהוא,
    // ו-enforced אומר למסך אם הוא חוסם בפועל.
    const open = site?.status === 'locked' && m06 >= 1;

    return ok({
      site,
      gate: {
        open,
        enforced: enforce === true,
        blocking: enforce === true && !open,
        m06,
        locked: site?.status === 'locked',
      },
      counts,
      total: items.length,
      sources_of_approved: sources,
      covering_institutes: covering,
      mou: repository.listMou(),
    });
  }

  return function handle(request) {
    if (request?.action === 'get_gate') return getGate(request?.payload);
    throw new Error(`BE-06 אינו מממש את הפעולה ${String(request?.action)} בשלב זה`);
  };
}
