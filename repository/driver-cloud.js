// CORE-04: דרייבר האחסון של שלבים 5 עד 7, מסד הענן.
//
// המקור: מסמך הבנייה 2.8 סעיף 3 ("דרייבר ה-Repository, שלבים 5 עד 7:
// Supabase, /repository/driver-cloud.js"), סעיף 5, חוקי ברזל 3 ו-6;
// decision-05 סעיפים 2 ו-3 (מבחן ההחלפה, ושמות משתני הסביבה);
// תוכנית שלב 5 חלק ב, משימה 13.3 והכרעות ב1 עד ב6.
//
// **הקובץ היחיד במאגר שמכיר את מחרוזת החיבור לענן.** מבחן מבנה 01
// בודק בדיוק את זה: שמות משתני הסביבה ונתיב ה-REST של הספק יושבים
// כאן ובשום מקום אחר. הערכים עצמם אינם כאן: הם מגיעים כארגומנטים,
// ממשתני הסביבה בזמן האריזה או בזמן הבדיקה.
//
// אותו חוזה של דרייבר הדפדפן, ארבע פעולות: readTable, appendRow,
// updateRow, setRefKey. ה-Repository אינו יודע איזה מהשניים הוזרק,
// ואף מודול אינו יודע שיש שניים.
//
// **התבנית, הכרעה ב2**: ה-Repository סינכרוני וכל המודולים קוראים לו
// כך, והרשת אינה סינכרונית. לכן הדרייבר הוא מראה בזיכרון עם תור
// כתיבה: load() מושך את הטבלאות פעם אחת; קריאה מוגשת מהזיכרון;
// כתיבה מתבצעת בזיכרון מיד, ונשלחת למסד בתור, שורה אחר שורה, עם
// ניסיון חוזר בכשל רשת. שורה אינה אובדת: כשל זמני משאיר אותה בתור,
// וכשל קבוע (המסד דחה את השורה) נרשם ב-failures() ומדווח.
//
// **מה יושב בענן, הכרעה ב1**: שתים עשרה טבלאות. modules ו-allow_list
// הן ה-Registry של הקוד, ומגיעות מהזריעה בלבד, כמו בקובץ הארוז.
//
// **תרגום אחד**: שורת audit_log נושאת שדה from, מילה שמורה במסד,
// ושדות תוצאה שצורתם תלויה בשלב. במסד: from_module, ו-outcome
// כאובייקט. הדרייבר מתרגם לשם ובחזרה, והשורה שה-Orchestrator כותב
// וקורא אינה משתנה.

/** שמות משתני הסביבה, לפי המוסכמה של הספק (decision-05 סעיף 3). */
export const ENV_NAMES = Object.freeze({ url: 'SUPABASE_URL', key: 'SUPABASE_ANON_KEY' });

const REST_PATH = '/rest/v1/';

// אותן קבוצות של דרייבר הדפדפן, באותם כללים.
const REGISTRY = Object.freeze(['modules', 'allow_list']);
const REFERENCE = 'reference';
const SEEDED_ONLY = Object.freeze([...REGISTRY, REFERENCE]);
const APPEND_ONLY = Object.freeze(['audit_log', 'approvals', 'interactions']);
const ENTITIES = Object.freeze([
  'content_items',
  'sites',
  'sources',
  'institutes',
  'rights_mou',
  'geo_anchors',
  'exit_points',
  'sessions',
]);

/** שמות הטבלאות שהדרייבר מכיר, זהים לדרייבר הדפדפן. */
export const TABLE_NAMES = Object.freeze([...SEEDED_ONLY, ...APPEND_ONLY, ...ENTITIES]);

/** הטבלאות שיושבות במסד (הכרעה ב1). */
export const CLOUD_TABLES = Object.freeze([REFERENCE, ...APPEND_ONLY, ...ENTITIES]);

/** המפתח הראשי של כל טבלה בענן (הכרעה ב5): שדה המזהה של המפה. */
export const PRIMARY_KEYS = Object.freeze({
  reference: 'key',
  audit_log: 'request_id',
  approvals: 'approval_id',
  interactions: 'interaction_id',
  content_items: 'item_id',
  sites: 'site_id',
  sources: 'source_id',
  institutes: 'institute_id',
  rights_mou: 'mou_id',
  geo_anchors: 'anchor_id',
  exit_points: 'exit_id',
  sessions: 'session_id',
});

// סדר הקריאה: לפי זמן היכן שיש, ואחרת לפי המפתח, כדי שהמראה תהיה
// יציבה בין משיכות.
const ORDER_BY = Object.freeze({
  reference: 'key',
  audit_log: 'at,phase',
  approvals: 'time,approval_id',
  interactions: 'time,interaction_id',
  content_items: 'item_id',
  sites: 'site_id',
  sources: 'source_id',
  institutes: 'institute_id',
  rights_mou: 'mou_id',
  geo_anchors: 'anchor_id',
  exit_points: 'exit_id',
  sessions: 'started_at,session_id',
});

const AUDIT_LOG = 'audit_log';
const AUDIT_FIXED = ['request_id', 'phase', 'at', 'module', 'action'];

// עמוד קריאה: הספק מגביל תשובה אחת, ולכן טבלה גדולה נמשכת בעמודים.
const PAGE_SIZE = 1000;

// ניסיון חוזר בכשל זמני: שנייה, ואז כפול, עד תקרה. ערכים של הדרייבר
// ולא של המערכת: הם אינם משנים התנהגות עסקית.
const RETRY_FIRST_S = 1;
const RETRY_MAX_S = 8;
const MS_PER_SECOND = 1000;

function assertKnownTable(name) {
  if (!TABLE_NAMES.includes(name)) {
    throw new Error(`טבלה שאינה מוכרת לדרייבר: ${String(name)}`);
  }
}

function toDbAudit(row) {
  const { from, ...rest } = row;
  const outcome = {};
  for (const [key, value] of Object.entries(rest)) {
    if (!AUDIT_FIXED.includes(key)) outcome[key] = value;
  }
  return {
    request_id: row.request_id,
    phase: row.phase,
    at: row.at ?? null,
    from_module: from ?? null,
    module: row.module ?? null,
    action: row.action ?? null,
    outcome,
  };
}

function fromDbAudit(row) {
  // באותו סדר שדות שה-Orchestrator כותב: השוואת JSON רגישה לסדר.
  return {
    request_id: row.request_id,
    phase: row.phase,
    at: row.at,
    from: row.from_module,
    module: row.module,
    action: row.action,
    ...(row.outcome ?? {}),
  };
}

// כשל שהמסד עצמו החזיר: השורה נדחתה ולא תתקבל גם בניסיון הבא.
// כשל רשת או כשל שרת הם זמניים.
function isPermanent(status) {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/**
 * @param {object} options
 * @param {object} [options.env] משתני הסביבה בשמם, כפי שהאריזה
 *   מזריקה אותם: הדרייבר קורא מהם את שני הערכים לפי ENV_NAMES.
 * @param {string} [options.url] כתובת הפרויקט, ערך SUPABASE_URL.
 * @param {string} [options.key] המפתח הציבורי, ערך SUPABASE_ANON_KEY.
 * @param {Function} [options.fetch] הרשת. בדיקה מזריקה רשת מדומה.
 * @param {object} [options.seed] modules ו-allow_list. שאר המפתחות
 *   אינם נזרעים כאן: הזריעה למסד היא כלי נפרד שעובר בדרייבר.
 * @param {object} [options.schedule] setTimeout, להזרקה בבדיקה.
 * @param {Function} [options.onFailure] נקרא בכשל קבוע של שורה.
 */
export function createCloudDriver({
  env = null,
  url = env?.[ENV_NAMES.url],
  key = env?.[ENV_NAMES.key],
  fetch: network = globalThis.fetch,
  seed = {},
  schedule = { setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms) },
  onFailure = null,
} = {}) {
  if (typeof url !== 'string' || url.trim() === '' || typeof key !== 'string' || key.trim() === '') {
    throw new Error(`דרייבר הענן זקוק לשני ערכים ממשתני הסביבה: ${ENV_NAMES.url} ו-${ENV_NAMES.key}`);
  }
  if (typeof network !== 'function') {
    throw new Error('אין רשת זמינה: יש להזריק fetch');
  }

  const base = url.replace(/\/+$/, '') + REST_PATH;
  const tables = {};
  for (const name of REGISTRY) tables[name] = seed[name];
  let loaded = false;

  const queue = [];
  const failures = [];
  let inFlight = null;
  let retryDelayS = RETRY_FIRST_S;
  let retryArmed = false;

  function headers(extra = {}) {
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  async function request(method, path, { body, prefer } = {}) {
    const response = await network(base + path, {
      method,
      headers: headers(prefer ? { Prefer: prefer } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return response;
  }

  // --- קריאה ---

  async function pull(name) {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const response = await network(`${base}${name}?select=*&order=${ORDER_BY[name]}`, {
        method: 'GET',
        headers: headers({ Range: `${from}-${from + PAGE_SIZE - 1}`, 'Range-Unit': 'items' }),
      });
      if (!response.ok) {
        throw new Error(`המסד לא החזיר את ${name}: ${response.status}`);
      }
      const page = await response.json();
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return rows;
  }

  function store(name, rows) {
    if (name === REFERENCE) {
      tables[name] = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    } else if (name === AUDIT_LOG) {
      tables[name] = rows.map(fromDbAudit);
    } else {
      tables[name] = rows;
    }
  }

  async function load() {
    const pulled = await Promise.all(CLOUD_TABLES.map((name) => pull(name)));
    CLOUD_TABLES.forEach((name, index) => store(name, pulled[index]));
    // מה שממתין בתור טרם הגיע למסד, ולכן הוא מוחל שוב על המראה.
    for (const item of queue) item.apply();
    loaded = true;
  }

  // --- התור ---

  function enqueue(item) {
    queue.push(item);
    drain();
  }

  async function send(item) {
    if (item.kind === 'append') {
      return request('POST', item.table, { body: item.body, prefer: 'return=minimal' });
    }
    if (item.kind === 'upsert') {
      return request('POST', item.table, {
        body: item.body,
        prefer: 'return=minimal,resolution=merge-duplicates',
      });
    }
    return request('PATCH', `${item.table}?${item.key}=eq.${encodeURIComponent(item.id)}`, {
      body: item.body,
      prefer: 'return=minimal',
    });
  }

  function armRetry() {
    if (retryArmed) return;
    retryArmed = true;
    schedule.setTimeout(() => {
      retryArmed = false;
      drain();
    }, retryDelayS * MS_PER_SECOND);
    retryDelayS = Math.min(retryDelayS * 2, RETRY_MAX_S);
  }

  function drain() {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      while (queue.length > 0) {
        const item = queue[0];
        let response;
        try {
          response = await send(item);
        } catch (error) {
          // כשל רשת: השורה נשארת בראש התור, וננסה שוב אחרי השהיה.
          armRetry();
          return;
        }
        if (response.ok) {
          queue.shift();
          retryDelayS = RETRY_FIRST_S;
          continue;
        }
        if (isPermanent(response.status)) {
          queue.shift();
          let detail = '';
          try { detail = await response.text(); } catch { /* אין גוף */ }
          const failure = { table: item.table, kind: item.kind, status: response.status, detail, body: item.body };
          failures.push(failure);
          onFailure?.(failure);
          continue;
        }
        armRetry();
        return;
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  }

  return {
    /** מושך את שתים עשרה הטבלאות למראה. חובה לפני הקריאה הראשונה. */
    load,

    /** מושך שוב: מה שמכשיר אחר כתב נראה אחרי הקריאה הזאת. */
    async refresh() {
      await drain();
      await load();
    },

    loaded: () => loaded,

    readTable(name) {
      assertKnownTable(name);
      return tables[name];
    },

    appendRow(name, row) {
      assertKnownTable(name);
      if (SEEDED_ONLY.includes(name)) {
        throw new Error(`הטבלה ${name} נזרעת ואינה נכתבת בזמן ריצה`);
      }
      const apply = () => { (tables[name] ??= []).push(row); };
      apply();
      enqueue({ kind: 'append', table: name, body: name === AUDIT_LOG ? toDbAudit(row) : row, apply });
      return row;
    },

    setRefKey(refKey, value) {
      const apply = () => { (tables[REFERENCE] ??= {})[refKey] = value; };
      apply();
      enqueue({ kind: 'upsert', table: REFERENCE, body: { key: refKey, value }, apply });
      return value;
    },

    updateRow(name, rowKey, id, patch) {
      assertKnownTable(name);
      if (!ENTITIES.includes(name)) {
        throw new Error(`עדכון שורה אינו מותר בטבלה ${name}`);
      }
      const rows = tables[name] ?? [];
      const index = rows.findIndex((row) => row[rowKey] === id);
      if (index === -1) return undefined;
      const apply = () => {
        const current = tables[name] ?? [];
        const at = current.findIndex((row) => row[rowKey] === id);
        if (at !== -1) current[at] = { ...current[at], ...patch };
      };
      apply();
      enqueue({ kind: 'update', table: name, key: rowKey, id, body: patch, apply });
      return tables[name][index];
    },

    /** כמה שורות ממתינות בתור לשליחה. */
    queued: () => queue.length,

    /** השורות שהמסד דחה. */
    failures: () => failures.map((f) => ({ ...f })),

    /**
     * ניסיון אחד לשלוח את כל מה שממתין. מחזיר מה נשאר: queued
     * שאינו אפס פירושו כשל זמני, והתור ינסה שוב מעצמו.
     */
    async flush() {
      await drain();
      return { queued: queue.length, failed: failures.length };
    },
  };
}
