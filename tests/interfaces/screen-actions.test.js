// ממשקים: טבלת פעולות המסכים, מטריצה מלאה. משימה 8 בתוכנית שלב 2.
//
// המקור: מפה 4.4 ("הפעולות שלו ואותן בלבד"), מפה 4.3, ומפה 6.2
// ("רשימת המותר: כל צירוף מותר עובר, כל צירוף אחר נדחה").
//
// שלוש בדיקות ה-System בודקות דחייה אחת או שתיים לכל מסך, וזה מה
// שמסך עושה בפועל. כאן נבדקת המטריצה כולה: ארבעת שמות המסך כפול
// כל פעולה שקיימת בחוזה, מול ה-Orchestrator האמיתי. צירוף שנפתח
// בטעות ברשימת המותר ייתפס כאן, גם אם אף מסך אינו שולח אותו היום.
//
// הטבלה כאן מועתקת מ-4.4 ביד, ובכוונה: בדיקה שנגזרת מאותו קובץ
// שהיא בודקת אינה בודקת דבר.
//
//   node tests/interfaces/screen-actions.test.js

import { createBrowserDriver } from '../../repository/driver-browser.js';
import { createRepository } from '../../repository/index.js';
import { createOrchestrator } from '../../core/orchestrator.js';
import { createEndpoint } from '../../screens/endpoint.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('ממשקים: פעולות המסכים');

// מפה 4.4, מילה במילה.
const SCREEN_ACTIONS = {
  'screen-veto': ['submit', 'approve', 'reject', 'return', 'get_gate',
    'listItems', 'getItem', 'listApprovals'],
  'screen-traveler': ['session_start', 'session_end', 'ask', 'log',
    'get_gate', 'nearestExitPoint'],
  'screen-content': ['create_item', 'edit_item', 'verify_anchor', 'register_source',
    'register_exit_point', 'listItems', 'getItem', 'getSite', 'listSources', 'listExitPoints'],
  'screen-owner': ['register_mou', 'register_institute', 'set_enforce', 'get_lock_readiness',
    'lock_site', 'compute_metrics', 'export', 'getSite', 'listSources',
    'listInstitutes', 'listMou'],
};

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const repository = createRepository(createBrowserDriver({
  storage: memoryStorage(),
  seed: { modules: modulesFile, allow_list: allowFile, reference: referenceFile.values },
}));

// ה-handlers ריקים בכוונה: הבדיקה היא על ההרשאה ולא על התשובה.
// צירוף מותר יגיע ל-E-MODULE-FAILED, וזה בדיוק מה שמבדיל אותו
// מצירוף אסור, שנעצר קודם ב-E-ALLOW-DENIED.
const orchestrator = createOrchestrator({ repository, handlers: {} });
const send = createEndpoint({ handle: (envelope) => orchestrator.handle(envelope) });

// ארבעת שמות המסך נקראים מהנתונים, כמו בנקודת הכניסה.
const screenCallers = modulesFile.modules
  .map((m) => m.caller)
  .filter((caller) => typeof caller === 'string' && caller.startsWith('screen-'));

check('ארבעה מסכים', screenCallers.sort(), Object.keys(SCREEN_ACTIONS).sort());

// יקום הפעולות: כל פעולה שקיימת באיזשהו מודול בחוזה.
const ACTION_UNIVERSE = [...new Set(
  modulesFile.modules.flatMap((m) => (m.is_demo ? [] : m.actions)),
)].sort();

check('יקום הפעולות אינו ריק', ACTION_UNIVERSE.length > 0, true);

// לאיזה מודול שייכת כל פעולה. פעולה ששייכת ליותר ממודול אחד הייתה
// הופכת את המטריצה לדו משמעית, ולכן גם זה נבדק.
const ownerOf = {};
for (const module of modulesFile.modules) {
  if (module.is_demo) continue;
  for (const action of module.actions) {
    ownerOf[action] = ownerOf[action] ? [...ownerOf[action], module.id] : [module.id];
  }
}

check(
  'כל פעולה שייכת למודול אחד',
  Object.entries(ownerOf).filter(([, ids]) => ids.length > 1).map(([action]) => action),
  [],
);

// --- המטריצה ---

const wrongly = { allowed: [], denied: [] };

for (const caller of Object.keys(SCREEN_ACTIONS)) {
  for (const action of ACTION_UNIVERSE) {
    const response = await send({
      from: caller,
      module: ownerOf[action][0],
      action,
      payload: {},
    });

    const shouldPass = SCREEN_ACTIONS[caller].includes(action);
    const denied = response.error?.code === 'E-ALLOW-DENIED';

    if (shouldPass && denied) wrongly.denied.push(`${caller} ${action}`);
    if (!shouldPass && !denied) wrongly.allowed.push(`${caller} ${action}`);
  }
}

check('כל פעולה שבטבלה עוברת את רשימת המותר', wrongly.denied.sort(), []);
check('כל פעולה שאינה בטבלה נדחית', wrongly.allowed.sort(), []);

// --- הכיוון ההפוך: רשימת המותר אינה מכילה שורת מסך שאינה ב-4.4 ---

const screenRows = allowFile.rows
  .filter((row) => row.from.startsWith('screen-') && !row.is_demo)
  .map((row) => `${row.from} ${row.action}`)
  .sort();

const expectedRows = Object.entries(SCREEN_ACTIONS)
  .flatMap(([caller, actions]) => actions.map((action) => `${caller} ${action}`))
  .sort();

check('שורות המסך ברשימת המותר זהות ל-4.4', screenRows, expectedRows);

// --- כל בקשה נרשמה, גם זו שנדחתה (מבחן מבנה 04) ---

{
  const all = repository.listAudit();
  const ids = [...new Set(all.map((row) => row.request_id))];
  const requests = Object.keys(SCREEN_ACTIONS).length * ACTION_UNIVERSE.length;

  check('נרשמה בקשה לכל צירוף שנבדק', ids.length, requests);
  check('ולכל אחת שתי שורות', ids.every((id) => all.filter((r) => r.request_id === id).length === 2), true);

  // בקשה שנדחתה אינה מנותבת, ולכן שורת התשובה שלה נושאת את הקוד.
  const deniedRows = all.filter((row) => row.error_code === 'E-ALLOW-DENIED');
  check(
    'מספר הדחיות שווה למה שהמטריצה מצפה לו',
    deniedRows.length,
    requests - expectedRows.length,
  );
}

report(` (${Object.keys(SCREEN_ACTIONS).length} מסכים, ${ACTION_UNIVERSE.length} פעולות, ${Object.keys(SCREEN_ACTIONS).length * ACTION_UNIVERSE.length} צירופים)`);
