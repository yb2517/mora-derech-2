// ייבוא הקורפוס לרשומות. משימה 4 בתוכנית שלב 7. פיתוח בלבד.
//
// המקור: CLAUDE.md סעיף 2 (19 פריטי הקורפוס עוברים לרשומות בשלב 7),
// usecase-f-08 צעדים 1 עד 4, חוקי ברזל 1, 2, 3 ו-BL-01, ותוכנית שלב 7
// הכרעות 4, 10 ו-12.
//
// מה הכלי עושה, ומה לא:
//   הוא מרכיב את המערכת כפי שנקודת הכניסה מרכיבה אותה: דרייבר,
//   Repository, ה-Orchestrator, ו-BE-05 שנטען מעמודת handler בטבלת
//   המודולים ולא בייבוא. ואז הוא שולח מעטפות, כפי שמסך התוכן היה
//   שולח: register_source פעם אחת, ו-create_item לכל פריט. BE-05
//   מאמת שלמות, תחנה, מקור וגבולות, כותב את הפריט כ-draft, את העוגן
//   כלא מאומת ואת רשומת היצירה, וה-Orchestrator רושם כל בקשה
//   ב-audit_log. הכלי אינו כותב פריט, עוגן או רשומה בעצמו.
//
//   רשומת המסלול נכתבת דרך הדרייבר (הכרעה 10, פער 65): אין ב-4.2
//   פעולה שיוצרת מסלול, והוא נתון שנזרע מחוץ לזמן ריצה, כמו מפתחות
//   ה-reference החסרים שהכלי זורע באותו אופן.
//
//   הוא אינו שולח submit, approve או lock_site (הכרעה 4): ההכרעה על
//   פריט היא פעולת אדם בפאנל הווטו.
//
//   הרצה חוזרת אינה מכפילה: מסלול, מקור ופריט שכבר במסד מדולגים,
//   לפי מזהה המסלול ולפי שם המקור והפריט. BE-05 מקצה מזהה משלו לכל
//   פריט, ולכן ההתאמה בין מזהה הקורפוס למזהה הרשומה מודפסת בסוף.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node tools/import-corpus.js
//
// הערכים ממשתני הסביבה בלבד (מסמך הבנייה סעיף 3). audit_log אינו
// נזרע: הוא נכתב בידי ה-Orchestrator בלבד (BL-09). הטעינה מטבלת
// המודולים היא אותה טעינה של נקודת הכניסה: הכלי יושב ב-/tools/,
// שמבחן מבנה 08 סורק כשכבת מודול, ולכן אינו מייבא מודול או את
// ה-Orchestrator בשמו.

import { pathToFileURL } from 'node:url';

import { createCloudDriver, ENV_NAMES } from '../repository/driver-cloud.js';
import { createRepository } from '../repository/index.js';
import corpusFile from '../data/corpus/jaffa-01.json' with { type: 'json' };
import modulesFile from '../registry/modules.json' with { type: 'json' };
import allowFile from '../registry/allow-list.json' with { type: 'json' };
import referenceFile from '../data/reference.json' with { type: 'json' };

const GOVERNANCE = 'BE-05';
const CONTENT_SCREEN = 'FE-07';
const ORCHESTRATOR_FILE = 'core/orchestrator.js';
const LANG = 'he';

/** טעינה מהמאגר לפי נתיב מעמודת handler, כפי שנקודת הכניסה עושה. */
const loadFromRepository = (path) => import(new URL(`../${path}`, import.meta.url).href);

/**
 * מייבא את הקורפוס דרך המערכת, ומחזיר מה נכתב, מה דולג ומה נכשל.
 *
 * @param {object} options
 * @param {object} options.driver דרייבר אחסון בחוזה של CORE-04, טעון או שניתן לטעינה.
 * @param {object} [options.corpus] קובץ הקורפוס. ברירת המחדל: data/corpus/jaffa-01.json.
 * @param {object} [options.modules] טבלת המודולים.
 * @param {object} [options.reference] ערכי טבלת ה-reference לזריעת מפתחות חסרים.
 * @param {Function} [options.load] טוען קבצים לפי נתיב מהמאגר.
 */
export async function importCorpus({
  driver,
  corpus = corpusFile,
  modules = modulesFile,
  reference = referenceFile.values,
  load = loadFromRepository,
} = {}) {
  if (!driver) throw new Error('כלי הייבוא זקוק לדרייבר');
  if (typeof driver.load === 'function') await driver.load();

  const written = { reference: 0, sites: 0, sources: 0, items: 0 };
  const skipped = { reference: 0, sites: 0, sources: 0, items: 0 };
  const failures = [];
  const mapping = [];

  // מפתחות reference חסרים. מפתח שכבר במסד אינו נדרס: ערך שנכתב
  // בזמן ריצה, כמו enforce_gate_b, נשאר.
  const present = driver.readTable('reference') ?? {};
  for (const [key, value] of Object.entries(reference)) {
    if (Object.prototype.hasOwnProperty.call(present, key)) { skipped.reference += 1; continue; }
    driver.setRefKey(key, value);
    written.reference += 1;
  }

  const repository = createRepository(driver);

  // ההרכבה: BE-05 מעמודת handler, וה-Orchestrator עם ה-handler הזה בלבד.
  const governanceRow = modules.modules.find((row) => row.id === GOVERNANCE);
  const governance = await load(governanceRow.handler);
  const orchestration = await load(ORCHESTRATOR_FILE);
  const orchestrator = orchestration.createOrchestrator({
    repository,
    handlers: { [GOVERNANCE]: governance.create({ repository }) },
  });
  const from = modules.modules.find((row) => row.id === CONTENT_SCREEN).caller;
  const send = (action, payload) => orchestrator.handle({ from, module: GOVERNANCE, action, payload, lang: LANG });

  // המסלול: נתון שנזרע (הכרעה 10).
  const siteId = corpus.site.site_id;
  if (repository.getSite(siteId)) {
    skipped.sites += 1;
  } else {
    driver.appendRow('sites', { ...corpus.site, stops: [...corpus.site.stops], bounds: { ...corpus.site.bounds } });
    written.sites += 1;
  }

  // המקור: register_source, פעם אחת.
  let sourceId = repository.listSources().find((row) => row.name === corpus.source.name)?.source_id ?? null;
  if (sourceId) {
    skipped.sources += 1;
  } else {
    const { name, file, publisher } = corpus.source;
    const response = await send('register_source', { name, file, publisher });
    if (!response.ok) {
      failures.push({ what: 'source', name, code: response.error?.code ?? null, data: response.error?.data ?? null });
    } else {
      sourceId = response.data.source.source_id;
      written.sources += 1;
    }
  }

  // הפריטים: create_item לכל פריט שאינו במסד, לפי שם.
  const existingNames = new Set(repository.listItems({ site_id: siteId }).map((row) => row.name));
  for (const item of corpus.items) {
    if (existingNames.has(item.name)) { skipped.items += 1; continue; }
    if (!sourceId) { failures.push({ what: 'item', item_id: item.item_id, code: 'E-ITEM-INCOMPLETE', data: { field: 'source_id' } }); continue; }
    const response = await send('create_item', {
      site_id: siteId,
      stop_id: item.stop_id,
      source_id: sourceId,
      name: item.name,
      text: item.text,
      page: item.page,
      lat: item.lat,
      lng: item.lng,
      audience: item.audience,
    });
    if (!response.ok) {
      failures.push({ what: 'item', item_id: item.item_id, code: response.error?.code ?? null, data: response.error?.data ?? null });
      continue;
    }
    mapping.push([item.item_id, response.data.item.item_id]);
    written.items += 1;
  }

  const flush = typeof driver.flush === 'function' ? await driver.flush() : { queued: 0, failed: 0 };
  const rejected = typeof driver.failures === 'function' ? driver.failures() : [];

  return { written, skipped, failures, mapping, flush, rejected };
}

// הרצה ישירה: מול מסד הענן, ממשתני הסביבה.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const driver = createCloudDriver({ env: process.env, seed: { modules: modulesFile, allow_list: allowFile } });
  const result = await importCorpus({ driver });

  console.log('נכתב:', JSON.stringify(result.written));
  console.log('דולג, כבר במסד:', JSON.stringify(result.skipped));
  for (const [corpusId, itemId] of result.mapping) console.log(`  ${corpusId} -> ${itemId}`);
  for (const failure of result.failures) console.error('נדחה במודול:', JSON.stringify(failure));
  for (const failure of result.rejected) console.error(`  ${failure.table}: ${failure.status} ${failure.detail}`);

  if (result.failures.length > 0 || result.flush.queued > 0 || result.flush.failed > 0) {
    console.error(`לא הושלם: ${result.failures.length} נדחו במודול, ${result.flush.queued} ממתינות, ${result.flush.failed} נדחו במסד`);
    process.exit(1);
  }
  console.log(`הייבוא הושלם, והמסד קיבל את כל השורות (${ENV_NAMES.url} מהסביבה).`);
}
