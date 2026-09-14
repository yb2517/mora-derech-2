// מסך הניהול המאוחד: FE-07 ו-FE-08. משימה 7 בתוכנית שלב 2.
//
// המקור: מפה 3.3 שורות FE-07 ו-FE-08, מפה 4.4, ההכרעה מ-12.09
// ("מסך ניהול אחד עם role במקום שני מסכים"), doc-build-03-interfaces
// סעיפים 2.3 ו-2.4, ו-F-08, F-06, F-07, F-09.
//
// **מסך אחד, שני פונים.** ההכרעה איחדה את שני המסכים כדי לחסוך
// תחזוקה, והוסיפה במפורש: "רשימת המותר עדיין מבחינה לפי from".
// כלומר האיחוד הוא בתחזוקה ולא בהרשאות. לכן המסך נושא שני שמות
// פונה, שולח בשם זה שמתאים ל-role הפעיל, ואינו יכול לחצות את הגבול
// גם אם ירצה: שליחה בשם הלא נכון נדחית ב-E-ALLOW-DENIED.
//
// שמות הפונים אינם כתובים כאן. הם מגיעים בהזרקה לפי מזהה המודול,
// מטבלת המודולים (מפה 4.3, מבחן מבנה 06).
//
// מה שאינו כאן: אימות זהות. הוכרע 12.09 שאין ב-v1, ושתידרש סיסמה
// לפני שהפאנל יוצא למכון. מחליף ה-role הוא נוחות פיתוח ואינו הרשאה.

import { createElement, panel, humanError } from '../view.js';

// שני התפקידים של מסך הניהול, לפי ADMIN_USERS.role במפה 2.1.
// לכל אחד המודול שממנו נגזר שם הפונה שלו.
const ROLES = [
  { role: 'content', label: 'צוות התוכן', moduleId: 'FE-07' },
  { role: 'owner', label: 'בעלת הפרויקט', moduleId: 'FE-08' },
];

const STATE_LABEL = {
  draft: 'טיוטה',
  pending: 'הוגש',
  approved: 'מאושר',
  rejected: 'נדחה',
};

// שדות הפריט, לפי מפה 2.1 ולפי תנאי השלמות בטבלת המעברים 2.2.
const ITEM_FIELDS = [
  { name: 'name', label: 'שם הפריט' },
  { name: 'stop_id', label: 'תחנה', from: 'stops' },
  { name: 'source_id', label: 'מקור', from: 'sources' },
  { name: 'page', label: 'עמוד' },
  { name: 'text', label: 'טקסט', long: true },
  { name: 'audience', label: 'קהל' },
];

export function create({ host, from, reference, send }) {
  const view = {
    role: ROLES[0].role,
    ready: false,
    sample: null,
    site: null,
    items: [],
    sources: [],
    exitPoints: [],
    institutes: [],
    mou: [],
    readiness: [],
    metrics: [],
    open: null,
    form: {},
    // טפסי הרישום של בעלת הפרויקט, משימה 7 בתוכנית שלב 3. שדות
    // RIGHTS_MOU ו-INSTITUTES לפי מפה 2.1.
    mouForm: {
      institute_id: '', scope: [], signed_at: '', valid_until: '',
      // הוכרע 12.09.2026: ההסכם מכסה אישור וגם תרומת תוכן. השדה
      // קיים בישות (מפה 2.1), ולכן הוא נשאל ואינו נכתב בשקט.
      covers_content_contribution: true,
    },
    instituteForm: { name: '' },
    message: null,
    error: null,
    // שגיאה שנוגעת לפאנל אחד בלבד. פאנל שהמודול שלו טרם נבנה אינו
    // מפיל את שאר המסך: הוא אומר מה חסר במקומו (הכרעה 3 בתוכנית
    // שלב 3).
    panelErrors: {},
  };

  const errorText = (error) => humanError(reference?.error_human_text, error);

  const activeRole = () => ROLES.find((r) => r.role === view.role);

  // שם הפונה נבחר לפי ה-role הפעיל, ומגיע מהמפה שהוזרקה. אין כאן
  // שם פונה כתוב, ואין דרך לשלוח בשם שלא הוזרק.
  async function ask(module, action, payload) {
    return send({ from: from[activeRole().moduleId], module, action, payload });
  }

  function absorb(response) {
    if (response.ok) {
      view.error = null;
      return true;
    }
    view.error = response.error;
    return false;
  }

  // --- טעינה ---

  async function load() {
    view.message = null;

    // המסלול נלמד מ-getSite, שפתוח לשני ה-roles (מפה 4.2), ולא
    // מ-get_gate, שצוות התוכן אינו מורשה לו. בגרסה 1 יש מסלול
    // אחד, ולכן הבקשה יוצאת בלי מזהה. אין במפה פעולה שמודיעה
    // למסך על איזה מסלול הוא עובד, וזה מדווח בדוח השלב.
    const site = await ask('BE-05', 'getSite', {});
    if (!absorb(site)) return render();
    view.site = site.data?.site ?? null;
    const siteId = view.site?.site_id;

    const sources = await ask('BE-05', 'listSources', { site_id: siteId });
    if (!absorb(sources)) return render();
    view.sources = sources.data?.sources ?? [];

    await (view.role === 'content' ? loadContent(siteId) : loadOwner(siteId));
    render();
  }

  async function loadContent(siteId) {
    const [items, exits] = await Promise.all([
      ask('BE-05', 'listItems', { site_id: siteId }),
      ask('BE-05', 'listExitPoints', { site_id: siteId }),
    ]);
    if (!absorb(items) || !absorb(exits)) return;
    view.items = items.data?.items ?? [];
    view.exitPoints = exits.data?.exit_points ?? [];
  }

  async function loadOwner(siteId) {
    const [institutes, mou, readiness, metrics] = await Promise.all([
      // חוב טכני 12 של דוח שלב 3: שתי הפעולות אינן מסננות לפי
      // מסלול, ואין ב-4.2 סינון מוגדר להן. המסך הפסיק לשלוח
      // site_id שאינו מסנן דבר, במקום להיראות כאילו הוא מסנן.
      ask('BE-05', 'listInstitutes', {}),
      ask('BE-05', 'listMou', {}),
      ask('BE-06', 'get_lock_readiness', { site_id: siteId }),
      ask('BE-07', 'compute_metrics', { site_id: siteId }),
    ]);

    // שתי הראשונות הן ליבת המסך של בעלת הפרויקט, ובלעדיהן אין מה
    // להציג. שתי האחרונות הן פאנלים נפרדים, וכשהמודול שלהן טרם
    // נבנה הפאנל אומר זאת והשאר ממשיך לעבוד.
    if (!absorb(institutes) || !absorb(mou)) return;
    view.institutes = institutes.data?.institutes ?? [];
    view.mou = mou.data?.mou ?? [];

    view.panelErrors = {};
    // BE-06 מחזיר { readiness: { conditions, ready, failed } }. עד
    // שלב 3 ההדגמה החזירה conditions בשורש, מפני שהחישוב לא היה
    // קיים (משימה 11 בתוכנית שלב 4).
    if (readiness.ok) {
      view.readiness = readiness.data?.readiness?.conditions ?? [];
      view.ready = readiness.data?.readiness?.ready === true;
    } else {
      view.readiness = [];
      view.ready = false;
      view.panelErrors.readiness = readiness.error;
    }

    if (metrics.ok) {
      view.metrics = metrics.data?.metrics ?? [];
      view.sample = { n: metrics.data?.n ?? 0, small: metrics.data?.sample_small === true };
    } else {
      view.metrics = [];
      view.sample = null;
      view.panelErrors.metrics = metrics.error;
    }
  }

  async function switchRole(role) {
    view.role = role;
    view.open = null;
    view.form = {};
    await load();
  }

  // --- פעולות ---

  /**
   * פעולה שמשנה נתונים, ואז טעינה מחדש.
   *
   * עד שלב 3 הפעולות נענו בהדגמה ולא שינו דבר, ולכן די היה
   * בהודעה. משלב 4 הן משנות מצב, והמסך חייב להראות את מה שקרה
   * ולא רק לומר ששלח (משימה 11 בתוכנית שלב 4).
   */
  async function act(module, action, payload) {
    const response = await ask(module, action, payload);
    if (!absorb(response)) return render();
    await load();
    view.message = `הפעולה ${action} בוצעה.`;
    render();
  }

  async function openItem(itemId) {
    if (view.open?.item?.item_id === itemId) {
      view.open = null;
      view.form = {};
      return render();
    }
    const response = await ask('BE-05', 'getItem', { item_id: itemId });
    if (!absorb(response)) return render();
    view.open = response.data ?? null;
    view.form = { ...(response.data?.item ?? {}) };
    render();
  }

  // רישום ההסכם, usecase-f-07 צעדים 12 ו-13. המסך אוסף את השדות
  // שמפה 2.1 מגדירה לישות RIGHTS_MOU, ושולח. השלמות נאכפת ב-BE-05
  // ומוחזרת כ-E-ITEM-INCOMPLETE עם שם השדה, ולכן אין כאן בדיקה
  // מקבילה: שני מקומות שבודקים הם שני מקומות שנפרדים.
  async function registerMou() {
    const response = await ask('BE-05', 'register_mou', { ...view.mouForm });
    if (!absorb(response)) return render();
    view.mouForm = {
      institute_id: '', scope: [], signed_at: '', valid_until: '',
      covers_content_contribution: true,
    };
    // הטעינה קודמת להודעה: load מנקה את ההודעה הקודמת, והודעה
    // שתיקבע לפניה תימחק בדרך.
    await load();
    view.message = 'ההסכם נרשם, ומצב השער חושב מחדש.';
    render();
  }

  async function registerInstitute() {
    const response = await ask('BE-05', 'register_institute', { ...view.instituteForm });
    if (!absorb(response)) return render();
    view.instituteForm = { name: '' };
    await load();
    view.message = 'המכון נרשם.';
    render();
  }

  function saveItem() {
    // יצירה או עריכה, לפי אם יש פריט פתוח. שלמות השדות נאכפת
    // ב-BE-05 ומוחזרת כ-E-ITEM-INCOMPLETE עם שם השדה, ולכן המסך
    // אינו בודק כאן: שני מקומות שבודקים הם שני מקומות שנפרדים.
    const action = view.open ? 'edit_item' : 'create_item';
    return act('BE-05', action, { ...view.form, site_id: view.site?.site_id });
  }

  // --- תצוגה ---

  function roleSwitch() {
    return createElement('div', { class: 'btn-row' }, ROLES.map((r) => {
      const button = createElement(
        'button',
        { class: r.role === view.role ? 'btn btn--primary' : 'btn', type: 'button' },
        r.label,
      );
      button.disabled = r.role === view.role;
      button.addEventListener('click', () => switchRole(r.role));
      return button;
    }));
  }

  function field(spec) {
    const options = spec.from === 'stops' ? (view.site?.stops ?? [])
      : spec.from === 'sources' ? view.sources.map((s) => s.source_id)
        : null;

    const control = options
      ? createElement('select', { class: 'field__control', id: `admin-${spec.name}` },
        options.map((value) => createElement('option', { value }, String(value))))
      : createElement(spec.long ? 'textarea' : 'input',
        { class: 'field__control', id: `admin-${spec.name}`, type: 'text' });

    control.value = view.form[spec.name] ?? '';
    control.addEventListener('input', () => { view.form[spec.name] = control.value; });

    // שדה שחסר מסומן לפי E-ITEM-INCOMPLETE, שנושא את שמו ב-error.data.
    const invalid = view.error?.code === 'E-ITEM-INCOMPLETE'
      && view.error?.data?.field === spec.name;

    return createElement('div', { class: invalid ? 'field field--invalid' : 'field' }, [
      createElement('label', { class: 'field__label', for: `admin-${spec.name}` }, spec.label),
      control,
      invalid ? createElement('span', { class: 'field__error' }, errorText(view.error)) : null,
    ]);
  }

  function itemForm() {
    const children = ITEM_FIELDS.map(field);

    // עריכת פריט מאושר מחזירה אותו ל-draft ופותחת את המסלול (BL-07).
    // האזהרה נדרשת ב-2.3, והיא אזהרה ולא חסימה.
    if (view.open?.item?.status === 'approved') {
      children.push(createElement('div', { class: 'message message--warn' },
        'עריכת פריט מאושר מחזירה אותו לטיוטה, והמסלול ייפתח.'));
    }

    const save = createElement('button', { class: 'btn btn--primary', type: 'button' },
      view.open ? 'שמירת השינוי' : 'יצירת פריט');
    save.addEventListener('click', saveItem);

    const verify = createElement('button', { class: 'btn', type: 'button' }, 'אומת בשטח');
    verify.disabled = !view.open;
    verify.addEventListener('click', () => act('BE-05', 'verify_anchor', {
      item_id: view.open?.item?.item_id,
    }));

    children.push(createElement('div', { class: 'btn-row' }, [save, verify]));
    return createElement('div', {}, children);
  }

  function itemList() {
    if (view.items.length === 0) return createElement('p', { class: 'empty' }, 'אין פריטים.');
    return createElement('ul', { class: 'list' }, view.items.map((item) => {
      const head = createElement('button', { class: 'list__head', type: 'button' }, [
        createElement('span', {}, [
          createElement('span', { class: 'list__title' }, item.name),
          createElement('span', { class: 'list__meta' }, `${item.stop_id}, עמוד ${item.page}`),
        ]),
        createElement('span', { class: `status status--${item.status}` }, STATE_LABEL[item.status]),
      ]);
      head.addEventListener('click', () => openItem(item.item_id));
      return createElement('li', { class: 'list__item' }, [head]);
    }));
  }

  function anchorPanel() {
    if (!view.open) return createElement('p', { class: 'empty' }, 'בחרו פריט כדי לראות את העוגן.');
    const anchor = view.open.anchor;
    if (!anchor) return createElement('p', { class: 'empty' }, 'לפריט אין עוגן רשום.');
    return createElement('div', {}, [
      createElement('p', { class: 'list__meta' }, `${anchor.lat}, ${anchor.lng}`),
      createElement('span', { class: anchor.verified ? 'status status--approved' : 'status status--pending' },
        anchor.verified ? 'אומת בשטח' : 'לא אומת'),
      createElement('p', { class: anchor.is_crossing ? 'message message--warn' : 'text-sm text-muted' },
        anchor.is_crossing ? 'נקודת חצייה: אין מסירה כאן.' : 'אינה נקודת חצייה.'),
    ]);
  }

  function exitPointsPanel() {
    const add = createElement('button', { class: 'btn', type: 'button' }, 'רישום נקודת יציאה');
    add.addEventListener('click', () => act('BE-05', 'register_exit_point', {
      site_id: view.site?.site_id,
    }));

    const list = view.exitPoints.length === 0
      ? createElement('div', { class: 'message message--error' }, errorText({ code: 'E-NO-EXIT-POINT' }))
      // שורת תצוגה ולא שורה שנלחצת: list__head הוא ראש שורה
      // שנפתחת, ונקודת יציאה אינה נפתחת.
      : createElement('ul', { class: 'list' }, view.exitPoints.map((point) => createElement(
        'li', { class: 'list__item' }, [
          createElement('span', { class: 'list__title' }, point.name),
          createElement('span', { class: 'list__meta' }, point.type),
        ],
      )));

    return createElement('div', {}, [list, createElement('div', { class: 'btn-row' }, [add])]);
  }

  function sourcesPanel() {
    const add = createElement('button', { class: 'btn', type: 'button' }, 'רישום מקור');
    add.addEventListener('click', () => act('BE-05', 'register_source', {
      site_id: view.site?.site_id,
    }));
    const rows = view.sources.map((source) => createElement('tr', {}, [
      createElement('td', {}, source.name),
      createElement('td', {}, source.publisher ?? ''),
    ]));
    return createElement('div', {}, [
      createElement('table', { class: 'table' }, rows),
      createElement('div', { class: 'btn-row' }, [add]),
    ]);
  }

  // שדה בטופס רישום, עם סימון השדה שחזר חסר מ-BE-05.
  function formField(name, label, control) {
    const invalid = view.error?.code === 'E-ITEM-INCOMPLETE' && view.error?.data?.field === name;
    return createElement('div', { class: invalid ? 'field field--invalid' : 'field' }, [
      createElement('label', { class: 'field__label', for: `mou-${name}` }, label),
      control,
      invalid ? createElement('span', { class: 'field__error' }, errorText(view.error)) : null,
    ]);
  }

  function mouFormPanel() {
    const institute = createElement('select', { class: 'field__control', id: 'mou-institute_id' }, [
      createElement('option', { value: '' }, 'בחירת מכון'),
      ...view.institutes.map((row) => createElement('option', { value: row.institute_id }, row.name)),
    ]);
    institute.value = view.mouForm.institute_id;
    institute.addEventListener('input', () => { view.mouForm.institute_id = institute.value; });

    // ההיקף הוא רשימת המקורות שההסכם מכסה (מפה 2.1). התצוגה מראה
    // את כל מקורות המסלול, כדי שההשוואה בין ההיקף לבין מה שהמסלול
    // צריך תהיה גלויה (usecase-f-07 סעיף 6).
    const scope = createElement('div', { class: 'btn-row' }, view.sources.map((source) => {
      const chosen = view.mouForm.scope.includes(source.source_id);
      const button = createElement(
        'button',
        { class: chosen ? 'btn btn--primary' : 'btn', type: 'button' },
        source.name,
      );
      button.addEventListener('click', () => {
        view.mouForm.scope = chosen
          ? view.mouForm.scope.filter((id) => id !== source.source_id)
          : [...view.mouForm.scope, source.source_id];
        render();
      });
      return button;
    }));

    function dateField(name, label) {
      const control = createElement('input', { class: 'field__control', id: `mou-${name}`, type: 'date' });
      control.value = view.mouForm[name];
      control.addEventListener('input', () => { view.mouForm[name] = control.value; });
      return formField(name, label, control);
    }

    // הוכרע 12.09.2026: ההסכם מכסה אישור וגם תרומת תוכן. ברירת
    // המחדל היא כן, ובעלת הפרויקט יכולה לכבות אותה להסכם שאינו כזה.
    const covers = createElement(
      'button',
      { class: view.mouForm.covers_content_contribution ? 'btn btn--primary' : 'btn', type: 'button' },
      view.mouForm.covers_content_contribution ? 'מכסה גם תרומת תוכן' : 'אישור בלבד',
    );
    covers.addEventListener('click', () => {
      view.mouForm.covers_content_contribution = !view.mouForm.covers_content_contribution;
      render();
    });

    const submit = createElement('button', { class: 'btn btn--primary', type: 'button' }, 'רישום הסכם');
    submit.addEventListener('click', registerMou);

    const name = createElement('input', { class: 'field__control', id: 'mou-name', type: 'text' });
    name.value = view.instituteForm.name;
    name.addEventListener('input', () => { view.instituteForm.name = name.value; });
    const addInstitute = createElement('button', { class: 'btn', type: 'button' }, 'רישום מכון');
    addInstitute.addEventListener('click', registerInstitute);

    return createElement('div', {}, [
      formField('institute_id', 'המכון', institute),
      formField('scope', `היקף ההסכם: ${view.mouForm.scope.length} מתוך ${view.sources.length} מקורות`, scope),
      dateField('signed_at', 'תאריך חתימה'),
      dateField('valid_until', 'תאריך תוקף'),
      createElement('div', { class: 'btn-row' }, [covers]),
      createElement('div', { class: 'btn-row' }, [submit]),
      formField('name', 'מכון חדש', name),
      createElement('div', { class: 'btn-row' }, [addInstitute]),
    ]);
  }

  function rightsPanel() {
    const rows = view.mou.map((mou) => {
      const institute = view.institutes.find((i) => i.institute_id === mou.institute_id);
      return createElement('tr', {}, [
        createElement('td', {}, institute?.name ?? mou.institute_id),
        createElement('td', {}, `${mou.scope.length} מקורות`),
        createElement('td', {}, mou.valid_until ?? ''),
      ]);
    });

    // מתג האכיפה. 2.4 דורש שיוצג מה ייחסם, ולא רק המתג עצמו.
    const toggle = createElement('button', { class: 'btn', type: 'button' }, 'החלפת מצב האכיפה');
    toggle.addEventListener('click', () => act('BE-06', 'set_enforce', {}));

    return createElement('div', {}, [
      rows.length > 0
        ? createElement('table', { class: 'table' }, rows)
        : createElement('p', { class: 'empty' }, 'אין הסכמים רשומים.'),
      createElement('p', { class: 'text-sm text-muted' },
        'הדלקת האכיפה חוסמת את מסך המטייל כל עוד המסלול אינו נעול.'),
      createElement('div', { class: 'btn-row' }, [toggle]),
    ]);
  }

  // פאנל שהמודול שלו טרם נבנה מציג את הנוסח לאדם של הקוד שחזר,
  // במקום טבלה ריקה שנראית כאילו אין נתונים. הנוסח מגיע מטבלת
  // ה-reference (BL-12), ולא מכאן.
  function panelNotice(key) {
    const error = view.panelErrors[key];
    return error ? createElement('div', { class: 'message message--error' }, errorText(error)) : null;
  }

  function readinessPanel() {
    const rows = view.readiness.map((condition) => createElement('tr', {}, [
      createElement('td', {}, condition.id ?? condition.condition),
      createElement('td', {}, condition.name),
      createElement('td', {}, [
        createElement('span', { class: condition.passes ? 'status status--approved' : 'status status--rejected' },
          condition.passes ? 'עובר' : 'לא עובר'),
        condition.failing?.length
          ? createElement('span', { class: 'list__meta' }, condition.failing.join(', '))
          : null,
      ]),
    ]));

    const lock = createElement('button', { class: 'btn btn--primary', type: 'button' }, 'נעילת המסלול');
    // הנעילה אינה מנוטרלת לפי הטבלה: התנאים נאכפים ב-BL-06, והמסך
    // אינו משכפל אותם. סירוב חוזר כ-E-LOCK-REFUSED עם רשימת הכשלים.
    lock.addEventListener('click', () => act('BE-05', 'lock_site', {
      site_id: view.site?.site_id,
    }));

    return createElement('div', {}, [
      panelNotice('readiness'),
      createElement('table', { class: 'table' }, rows),
      createElement('div', { class: 'btn-row' }, [lock]),
    ]);
  }

  function metricsPanel() {
    const rows = view.metrics.map((metric) => createElement('tr', {}, [
      createElement('td', {}, metric.metric),
      createElement('td', {}, metric.name),
      // ערך null הוא "אין נתון" ולא אפס: מדגם ריק אינו חציון אפס.
      createElement('td', {}, metric.value === null ? 'אין נתון' : String(metric.value)),
      createElement('td', {}, [
        createElement('span', { class: metric.passes ? 'status status--approved' : 'status status--rejected' },
          metric.passes ? 'עובר' : 'לא עובר'),
        createElement('span', { class: 'list__meta' }, `סף ${metric.threshold}`),
      ]),
    ]));

    const exportButton = createElement('button', { class: 'btn', type: 'button' }, 'ייצוא');
    exportButton.addEventListener('click', () => act('BE-07', 'export', {}));

    return createElement('div', {}, [
      panelNotice('metrics'),
      // usecase-f-09 צעד 11: מדגם קטן מהסף מסומן. מספר שמחושב על
      // מדגם קטן אינו שקר, אבל הוא אינו מכריע שער.
      view.sample
        ? createElement('p', { class: view.sample.small ? 'message message--warn' : 'text-sm text-muted' },
          view.sample.small
            ? `המדגם קטן מהסף: ${view.sample.n} סשנים`
            : `מדגם: ${view.sample.n} סשנים`)
        : null,
      createElement('table', { class: 'table' }, rows),
      // 2.4: ההכרעה Go או No-Go אינה במערכת. המסך מציג ואינו נועל.
      createElement('p', { class: 'text-sm text-muted' },
        'המסך מציג עובר או לא עובר. הכרעת המעבר אינה במערכת.'),
      createElement('div', { class: 'btn-row' }, [exportButton]),
    ]);
  }

  function render() {
    const children = [roleSwitch()];

    if (view.message) {
      children.push(createElement('div', { class: 'message message--done' }, view.message));
    }
    if (view.error && view.error.code !== 'E-ITEM-INCOMPLETE') {
      children.push(createElement('div', { class: 'message message--error' }, errorText(view.error)));
    }

    const panels = view.role === 'content'
      ? [
        panel('פריטי המסלול', itemList()),
        panel(view.open ? 'עריכת פריט' : 'פריט חדש', itemForm()),
        panel('העוגן', anchorPanel()),
        panel('המקורות', sourcesPanel()),
        panel('נקודות היציאה', exitPointsPanel()),
      ]
      : [
        panel('מכונים והסכמים', rightsPanel()),
        panel('רישום הסכם', mouFormPanel()),
        panel('מוכנות לנעילה', readinessPanel()),
        panel('המדדים', metricsPanel()),
      ];

    children.push(createElement('div', { class: 'layout layout--split' }, panels));
    host.replaceChildren(...children);
  }

  render();
  load();
  return { switchRole };
}
