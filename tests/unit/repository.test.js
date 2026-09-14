// Unit של CORE-04. נגזר מבדיקת הקבלה של משימה 5 בתוכנית שלב 1,
// ממפה 3.1, מ-BL-09 ומחוק ברזל 3. נכתב יחד עם הקוד.
//
//   node tests/unit/repository.test.js

import { createRepository } from '../../repository/index.js';
import { createBrowserDriver, TABLE_NAMES } from '../../repository/driver-browser.js';
import modulesFile from '../../registry/modules.json' with { type: 'json' };
import allowFile from '../../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../../data/reference.json' with { type: 'json' };
import { createChecker } from '../helpers/assert.js';

const { check, checkThrows, checkThrowsAsync, report } = createChecker('CORE-04 repository');

// אחסון בזיכרון עם אותו ממשק של אחסון הדפדפן. מאפשר להריץ את הבדיקה
// בלי דפדפן, ומוכיח שהדרייבר תלוי בממשק ולא במשתנה גלובלי.
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    get size() { return map.size; },
    keys: () => [...map.keys()],
  };
}

const seed = {
  modules: modulesFile,
  allow_list: allowFile,
  reference: referenceFile.values,
};

function freshRepository() {
  const storage = memoryStorage();
  const driver = createBrowserDriver({ storage, seed });
  return { repository: createRepository(driver), driver, storage };
}

// --- בדיקת הקבלה: appendAudit ואז קריאה ---

{
  const { repository } = freshRepository();
  check('audit_log נפתח ריק', repository.listAudit(), []);

  repository.appendAudit({ request_id: 'req-001', phase: 'request', from: 'screen-veto' });
  const rows = repository.listAudit();

  check('אחרי appendAudit השורה קיימת', rows.length, 1);
  check('השורה חזרה כפי שנרשמה', rows[0], {
    request_id: 'req-001', phase: 'request', from: 'screen-veto',
  });
}

// --- append-only: שתי שורות לאותה בקשה, כמו שמשימה 6 תדרוש ---

{
  const { repository } = freshRepository();
  repository.appendAudit({ request_id: 'req-002', phase: 'request' });
  repository.appendAudit({ request_id: 'req-002', phase: 'response' });
  repository.appendAudit({ request_id: 'req-003', phase: 'request' });

  check('שלוש שורות נרשמו', repository.listAudit().length, 3);
  check(
    'סינון לפי request_id מחזיר את שתי השורות של אותה בקשה',
    repository.listAudit({ request_id: 'req-002' }).map((r) => r.phase),
    ['request', 'response'],
  );
  check(
    'הסדר נשמר: מה שנרשם ראשון חוזר ראשון',
    repository.listAudit().map((r) => r.request_id),
    ['req-002', 'req-002', 'req-003'],
  );
}

// --- אין בממשק פעולת מחיקה ---

{
  const { repository } = freshRepository();
  const names = Object.keys(repository).sort();

  // ארבע הפעולות של שורה 5 בתוכנית, ועוד שתיים שבדיקות הקבלה מחייבות:
  // listAudit (שורה 5: "appendAudit ואז קריאה") ו-listCallers (שורה 6:
  // "from ברשימה הסגורה", ורק CORE-04 קורא נתונים).
  check('הממשק מונה בדיוק את שש הפעולות', names, [
    'appendAudit', 'getModule', 'getRef', 'listAllowed', 'listAudit', 'listCallers',
  ]);

  check(
    'אין פעולה שנשמעת כמחיקה או כדריסה',
    names.filter((n) => /delete|remove|drop|clear|truncate|reset|write|update|set/i.test(n)),
    [],
  );
}

// --- העתק ולא המערך החי: קורא אינו יכול לדרוס את היומן ---
//
// דרייבר הדפדפן מבודד לבד, מפני שהוא עובר דרך JSON בכל קריאה וכתיבה.
// לכן הוא אינו יכול להוכיח שה-index מעתיק. הבדיקה כאן משתמשת בדרייבר
// שמחזיר את האובייקט החי, וזה הדרייבר שבו הבידוד באמת נדרש.

function liveDriver() {
  const tables = { audit_log: [], reference: { interaction_types: ['initiated'] } };
  return {
    tables,
    readTable: (name) => tables[name],
    appendRow: (name, row) => { tables[name].push(row); return row; },
  };
}

{
  const driver = liveDriver();
  const repository = createRepository(driver);
  repository.appendAudit({ request_id: 'req-004', phase: 'request' });

  const stolen = repository.listAudit();
  stolen.length = 0;
  stolen.push({ request_id: 'מזויף' });

  check('שינוי במה שהוחזר אינו נוגע ביומן', repository.listAudit().length, 1);
  check('השורה המקורית שלמה', repository.listAudit()[0].request_id, 'req-004');
  check('היומן אצל הדרייבר לא נפגע', driver.tables.audit_log.length, 1);

  const row = { request_id: 'req-005', phase: 'request' };
  repository.appendAudit(row);
  row.phase = 'שונה אחרי הרישום';
  check(
    'שינוי באובייקט שנשלח אינו נוגע במה שנרשם',
    repository.listAudit({ request_id: 'req-005' })[0].phase,
    'request',
  );

  const list = repository.getRef('interaction_types');
  list.push('מומצא');
  check(
    'שינוי בערך שהוחזר אינו נוגע בטבלה שאצל הדרייבר',
    driver.tables.reference.interaction_types.length,
    1,
  );
}

// --- appendAudit דורש request_id, לפי מבחן מבנה 04 ---

{
  const { repository } = freshRepository();
  checkThrows('שורה בלי request_id נזרקת', () => repository.appendAudit({ phase: 'request' }));
  checkThrows('request_id ריק נזרק', () => repository.appendAudit({ request_id: '  ' }));
  checkThrows('שורה שאינה אובייקט נזרקת', () => repository.appendAudit('req-006'));
  checkThrows('מערך אינו שורה', () => repository.appendAudit([]));
  check('אף אחת מהן לא נרשמה', repository.listAudit(), []);
}

// --- getRef, BL-12 ---

{
  const { repository } = freshRepository();
  check('getRef על ערך מספרי', repository.getRef('relevance_threshold'), 0.28);
  check('getRef על ערך טקסטואלי', repository.getRef('fallback_text'), referenceFile.values.fallback_text);
  check('getRef על רשימה', repository.getRef('interaction_types').length, 7);
  check('getRef על טבלת הנוסחים', Object.keys(repository.getRef('error_human_text')).length, 22);
  check('getRef על מפתח שקיים ואין לו ערך מוכרע מחזיר null', repository.getRef('model_tier'), null);
  check('getRef על מפתח שאינו בטבלה מחזיר undefined', repository.getRef('no_such_key'), undefined);

}

// --- listAllowed ו-getModule, CORE-03 ---

{
  const { repository } = freshRepository();
  // 33 שורות המפה ועוד שורת ההדגמה של משימה 7, שמוסרת בשלב 7.
  check('listAllowed מחזיר את כל השורות', repository.listAllowed().length, 34);
  check(
    'מהן 33 שאינן הדגמה, כמספר צירופי 4.2',
    repository.listAllowed().filter((r) => !r.is_demo).length,
    33,
  );
  check('listCallers מחזיר את עשרת הפונים של 4.1', repository.listCallers().length, 10);
  check(
    'מודול הדמה אינו פונה ולכן אינו ברשימה',
    repository.listCallers().includes('test-echo'),
    false,
  );
  check('getModule על מודול קיים', repository.getModule('BE-05').handler, 'services/governance.js');
  check('getModule על מודול בלי פעולות', repository.getModule('CORE-02').actions, []);
  check('getModule על מזהה שאינו רשום', repository.getModule('BE-99'), undefined);
}

// --- הדרייבר: הטבלאות, הזריעה, והאיסור להוסיף לטבלה שאינה היומן ---

{
  const { driver, storage } = freshRepository();
  check('הדרייבר מכיר ארבע טבלאות', [...TABLE_NAMES], ['modules', 'allow_list', 'audit_log', 'reference']);
  check('ארבע הטבלאות נזרעו באחסון', storage.size, 4);
  check(
    'כל מפתח באחסון נושא את התחילית של המערכת',
    storage.keys().filter((k) => !k.startsWith('mora-derech/')),
    [],
  );
  checkThrows('טבלה שאינה מוכרת נזרקת', () => driver.readTable('secrets'));

  // הטענה אינה "נזרק" בלבד: בלי השומר, push על אובייקט זורק TypeError
  // וההוספה נראית חסומה גם כשאינה. הטענה היא שהטבלה אינה משתנה,
  // ושהשגיאה היא של השומר ולא תקלה מקרית.
  for (const table of ['modules', 'allow_list', 'reference']) {
    const before = JSON.stringify(driver.readTable(table));
    let message = '';
    try {
      driver.appendRow(table, { id: 'X' });
      message = 'לא נזרק';
    } catch (thrown) {
      message = thrown.message;
    }
    check(
      `הוספת שורה ל-${table} נחסמת בידי השומר`,
      message.includes('הוספת שורה מותרת ל-audit_log בלבד'),
      true,
    );
    check(`הטבלה ${table} לא השתנתה`, JSON.stringify(driver.readTable(table)), before);
  }
}

// --- זריעה חוזרת אינה דורסת ---

{
  const storage = memoryStorage();
  const first = createRepository(createBrowserDriver({ storage, seed }));
  first.appendAudit({ request_id: 'req-007', phase: 'request' });

  const second = createRepository(createBrowserDriver({ storage, seed }));
  check('דרייבר חדש על אותו אחסון רואה את מה שנרשם', second.listAudit().length, 1);
  check(
    'הזריעה החוזרת לא דרסה את היומן',
    second.listAudit().map((r) => r.request_id),
    ['req-007'],
  );
}

// --- מבחן ההחלפה: דרייבר אחר, אותו ממשק, אפס שינוי ב-index.js ---

{
  const tables = { audit_log: [], reference: { relevance_threshold: 0.28 } };
  const fakeCloudDriver = {
    readTable: (name) => tables[name],
    appendRow: (name, row) => { tables[name].push(row); return row; },
  };
  const repository = createRepository(fakeCloudDriver);
  repository.appendAudit({ request_id: 'req-008', phase: 'request' });

  check('דרייבר חלופי עובד בלי לשנות את הממשק', repository.listAudit().length, 1);
  check('getRef עובד מעליו', repository.getRef('relevance_threshold'), 0.28);
}

// --- דרייבר פגום נדחה בטעינה ---

checkThrows('דרייבר בלי readTable נדחה', () => createRepository({ appendRow() {} }));
checkThrows('דרייבר בלי appendRow נדחה', () => createRepository({ readTable() {} }));
checkThrows('בלי דרייבר כלל נדחה', () => createRepository());
checkThrows('דרייבר דפדפן בלי אחסון נדחה', () => createBrowserDriver({ storage: null }));

// --- סיכום ---

report();
