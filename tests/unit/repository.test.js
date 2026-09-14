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

  // שש פעולות המערכת של שלב 1, ושתים עשרה פעולות הישויות העסקיות
  // שנוספו במשימה 2 של שלב 3 (usecase-f-07 סעיף 8: השמות עסקיים).
  check('הממשק מונה בדיוק את שמונה עשרה הפעולות', names, [
    'appendApproval', 'appendAudit', 'appendInstitute', 'appendMou', 'appendSource',
    'getItem', 'getModule', 'getRef', 'getSite',
    'listAllowed', 'listApprovals', 'listAudit', 'listCallers', 'listInstitutes',
    'listItems', 'listMou', 'listSources', 'setStatus',
  ]);

  // setStatus היא הכתיבה היחידה שאינה הוספה, והיא מותרת: מפה 2.1
  // מגדירה את status כעמודה שמשתנה, וכותבה היחיד הוא BE-05 (BL-09).
  // כל השאר חייבות להיות קריאה או הוספה.
  check(
    'אין פעולה שנשמעת כמחיקה או כדריסה',
    names
      .filter((n) => n !== 'setStatus')
      .filter((n) => /delete|remove|drop|clear|truncate|reset|write|update|set/i.test(n)),
    [],
  );

  check(
    'אין פעולה שמעדכנת או מוחקת רשומת ביקורת',
    names.filter((n) => /(approval|audit)/i.test(n) && !/^(append|list)/.test(n)),
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
    updateRow: (name, key, id, patch) => {
      const index = (tables[name] ?? []).findIndex((row) => row[key] === id);
      if (index === -1) return undefined;
      tables[name][index] = { ...tables[name][index], ...patch };
      return tables[name][index];
    },
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
  check('getRef על רשימה', repository.getRef('interaction_types').length, 8);
  check('getRef על טבלת הנוסחים', Object.keys(repository.getRef('error_human_text')).length, 23);
  check('getRef על מפתח שקיים ואין לו ערך מוכרע מחזיר null', repository.getRef('model_tier'), null);
  check('getRef על מפתח שאינו בטבלה מחזיר undefined', repository.getRef('no_such_key'), undefined);

}

// --- listAllowed ו-getModule, CORE-03 ---

{
  const { repository } = freshRepository();
  // 34 צירופי 4.2 (כולל שורת פער 11) ועוד שורת ההדגמה של משימה 7.
  // שלוש מהן מסומנות להסרה בשלב 7, ואז נשארות 32 שורות ייצור.
  check('listAllowed מחזיר את כל השורות', repository.listAllowed().length, 47);
  check(
    'מהן 44 שורות ייצור',
    repository.listAllowed().filter((r) => !r.is_demo).length,
    44,
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
  // ארבע טבלאות המערכת של שלב 1, ושש הישויות העסקיות של מפה 2.1
  // שנוספו במשימה 2 של שלב 3.
  check('הדרייבר מכיר עשר טבלאות', [...TABLE_NAMES], [
    'modules', 'allow_list', 'reference',
    'audit_log', 'approvals',
    'content_items', 'sites', 'sources', 'institutes', 'rights_mou',
  ]);
  // עשר: שלוש טבלאות הנתונים מהזריעה, ושבע שנפתחות ריקות. טבלה
  // בלי זריעה נפתחת כרשימה ריקה, מלבד reference: מפתח חסר בה הוא
  // E-REF-EMPTY ולא ערך ריק, ולכן היא אינה נוצרת מעצמה.
  check('הטבלאות נזרעו באחסון', storage.size, 10);
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
    // שלוש טבלאות הנתונים נזרעות ואינן נכתבות בזמן ריצה. הטבלאות
    // העסקיות כן נכתבות, ולכן הן נבדקות בנפרד למטה.
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
      message.includes('נזרעת ואינה נכתבת בזמן ריצה'),
      true,
    );
    check(`הטבלה ${table} לא השתנתה`, JSON.stringify(driver.readTable(table)), before);
  }

  // עדכון שורה מותר בישויות העסקיות בלבד. יומן שאפשר לעדכן אינו יומן.
  for (const table of ['audit_log', 'approvals']) {
    let message = '';
    try {
      driver.updateRow(table, 'id', 'X', { note: 'שונה' });
      message = 'לא נזרק';
    } catch (thrown) {
      message = thrown.message;
    }
    check(
      `עדכון שורה ב-${table} נחסם`,
      message.includes('עדכון שורה אינו מותר'),
      true,
    );
  }
}

// --- הישויות העסקיות, משימה 2 בתוכנית שלב 3 ---

{
  const storage = memoryStorage();
  const repository = createRepository(createBrowserDriver({
    storage,
    seed: {
      ...seed,
      content_items: [
        { item_id: 'i-1', site_id: 's-1', stop_id: 'st-1', status: 'pending', source_id: 'src-1' },
        { item_id: 'i-2', site_id: 's-1', stop_id: 'st-2', status: 'draft', source_id: 'src-2' },
        { item_id: 'i-3', site_id: 's-2', stop_id: 'st-9', status: 'approved', source_id: 'src-3' },
      ],
      sites: [{ site_id: 's-1', name: 'מסלול', status: 'open' }],
      sources: [
        { source_id: 'src-1', name: 'מקור א' },
        { source_id: 'src-2', name: 'מקור ב' },
        { source_id: 'src-3', name: 'מקור של מסלול אחר' },
      ],
      institutes: [{ institute_id: 'inst-1', name: 'מכון' }],
      rights_mou: [],
    },
  }));

  check('getItem מחזיר פריט', repository.getItem('i-1').status, 'pending');
  check('getItem על מזהה שאינו קיים מחזיר null ולא שגיאה', repository.getItem('i-9'), null);
  check('listItems לפי מסלול', repository.listItems({ site_id: 's-1' }).map((i) => i.item_id), ['i-1', 'i-2']);
  check('listItems לפי מצב', repository.listItems({ status: 'draft' }).map((i) => i.item_id), ['i-2']);
  check('listItems לפי תחנה', repository.listItems({ stop_id: 'st-2' }).map((i) => i.item_id), ['i-2']);
  check('listItems בלי סינון מחזיר הכל', repository.listItems().length, 3);

  check('setStatus משנה את המצב', repository.setStatus('i-2', 'pending').status, 'pending');
  check('והשינוי נקרא מהאחסון', repository.getItem('i-2').status, 'pending');
  check('setStatus על פריט שאינו קיים מחזיר null', repository.setStatus('i-9', 'approved'), null);

  repository.appendApproval({
    approval_id: 'a-1', time: 't1', who: 'w', target: 'i-1',
    action: 'approve', from_status: 'pending', to_status: 'approved', note: '',
  });
  repository.appendApproval({
    approval_id: 'a-2', time: 't2', who: 'w', target: 'i-2',
    action: 'submit', from_status: 'draft', to_status: 'pending', note: '',
  });

  check('listApprovals מחזיר את שתי הרשומות', repository.listApprovals().length, 2);
  check('סינון לפי target', repository.listApprovals({ target: 'i-1' }).map((r) => r.approval_id), ['a-1']);
  checkThrows('רשומת APPROVALS בלי מזהה נדחית', () => repository.appendApproval({ target: 'i-1' }));
  checkThrows('רשומת APPROVALS שאינה אובייקט נדחית', () => repository.appendApproval('a'));

  check('getSite בלי מזהה מחזיר את המסלול היחיד', repository.getSite().site_id, 's-1');
  check('getSite על מזהה שאינו קיים מחזיר null', repository.getSite('s-9'), null);

  check('listSources מחזיר הכל', repository.listSources().length, 3);
  check(
    'listSources לפי מסלול מחזיר את המקורות שהפריטים מפנים אליהם',
    repository.listSources({ site_id: 's-1' }).map((s) => s.source_id),
    ['src-1', 'src-2'],
  );

  check('listInstitutes', repository.listInstitutes().map((i) => i.institute_id), ['inst-1']);
  check('listMou פותח ריק', repository.listMou(), []);
  repository.appendMou({ mou_id: 'mou-1', institute_id: 'inst-1', scope: ['src-1'] });
  check('appendMou ואז listMou', repository.listMou().map((m) => m.mou_id), ['mou-1']);
  repository.appendInstitute({ institute_id: 'inst-2', name: 'מכון שני' });
  check('appendInstitute', repository.listInstitutes().length, 2);
  repository.appendSource({ source_id: 'src-4', name: 'מקור חדש' });
  check('appendSource', repository.listSources().length, 4);

  // אותה הגנה של שלב 1: מה שיוצא הוא העתק.
  const items = repository.listItems();
  items.length = 0;
  check('שינוי במה שהוחזר אינו נוגע בנתונים', repository.listItems().length, 3);
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
    updateRow: (name, key, id, patch) => {
      const index = (tables[name] ?? []).findIndex((row) => row[key] === id);
      if (index === -1) return undefined;
      tables[name][index] = { ...tables[name][index], ...patch };
      return tables[name][index];
    },
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
