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
    // טופס ההסכם, משימה 8 בתוכנית שלב 3. נפרד מטופס הפריט, מפני
    // ששני טפסים שחולקים אובייקט אחד דורסים זה את זה.
    mouForm: { institute_id: '', scope: [], valid_until: '' },
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
    message: null,
    error: null,
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
      ask('BE-05', 'listInstitutes', { site_id: siteId }),
      ask('BE-05', 'listMou', { site_id: siteId }),
      ask('BE-06', 'get_lock_readiness', { site_id: siteId }),
      ask('BE-07', 'compute_metrics', { site_id: siteId }),
    ]);
    if (!absorb(institutes) || !absorb(mou) || !absorb(readiness) || !absorb(metrics)) return;
    view.institutes = institutes.data?.institutes ?? [];
    view.mou = mou.data?.mou ?? [];
    view.readiness = readiness.data?.conditions ?? [];
    view.metrics = metrics.data?.metrics ?? [];
  }

  async function switchRole(role) {
    view.role = role;
    view.open = null;
    view.form = {};
    await load();
  }

  // --- פעולות ---

  async function act(module, action, payload) {
    const response = await ask(module, action, payload);
    if (!absorb(response)) return render();
    view.message = response.data?.acknowledged ?? action;
    // משלב 3 חלק מהכתיבות משנות רשומות באמת, ולכן המסך נטען מחדש
    // ומראה את מה שנרשם. כתיבה שעדיין עומדת על ההדגמה תיטען
    // מחדש גם היא, ותראה את אותם נתונים: זה מה שאמור לקרות.
    await load();
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

    return wrapField(spec.name, spec.label, `admin-${spec.name}`, control);
  }

  // שדה שחסר מסומן לפי E-ITEM-INCOMPLETE, שנושא את שמו ב-error.data.
  // המעטפת משותפת לטופס הפריט ולטופס ההסכם: שני טפסים שמציגים
  // שגיאה בשתי דרכים הם שני מקומות שאחד מהם יישכח, וזה מה שקרה
  // בטופס ההסכם עד שהרצה בדפדפן הראתה שדה חסר בלי שום חיווי.
  function fieldIsInvalid(name) {
    return view.error?.code === 'E-ITEM-INCOMPLETE' && view.error?.data?.field === name;
  }

  function wrapField(name, label, id, control) {
    const invalid = fieldIsInvalid(name);
    return createElement('div', { class: invalid ? 'field field--invalid' : 'field' }, [
      createElement('label', { class: 'field__label', for: id }, label),
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

  function rightsPanel() {
    const rows = view.mou.map((mou) => {
      const institute = view.institutes.find((i) => i.institute_id === mou.institute_id);
      return createElement('tr', {}, [
        createElement('td', {}, institute?.name ?? mou.institute_id),
        createElement('td', {}, `${mou.scope.length} מקורות`),
        createElement('td', {}, mou.valid_until ?? ''),
      ]);
    });

    // טופס ההסכם, usecase-f-07 צעד 12: מכון, היקף המקורות ותאריך
    // תוקף. שם השדה valid_until מסומן [טרם נקבע] במפה לפי
    // decision-02, והוא נשלח בשם שנתוני ההדגמה כבר כותבים.
    //
    // המסך אינו בודק שלמות: השדה החסר חוזר ב-E-ITEM-INCOMPLETE עם
    // שמו, ו-BE-05 הוא שמכריע. שני מקומות שבודקים נפרדים זה מזה.
    const instituteSelect = createElement('select', { class: 'field__control', id: 'mou-institute' },
      [createElement('option', { value: '' }, 'בחירת מכון')].concat(
        view.institutes.map((i) => createElement('option', { value: i.institute_id }, i.name ?? i.institute_id)),
      ));
    instituteSelect.value = view.mouForm.institute_id;
    instituteSelect.addEventListener('input', () => { view.mouForm.institute_id = instituteSelect.value; });
    const instituteField = wrapField('institute_id', 'מכון', 'mou-institute', instituteSelect);

    const scopeBoxes = createElement('div', { class: 'btn-row' }, view.sources.map((source) => {
      const box = createElement('input', { type: 'checkbox', id: `mou-src-${source.source_id}` });
      box.checked = view.mouForm.scope.includes(source.source_id);
      box.addEventListener('change', () => {
        const chosen = new Set(view.mouForm.scope);
        if (box.checked) chosen.add(source.source_id);
        else chosen.delete(source.source_id);
        view.mouForm.scope = [...chosen];
      });
      return createElement('label', { class: 'text-sm', for: `mou-src-${source.source_id}` },
        [box, source.name ?? source.source_id]);
    }));
    const scopeField = wrapField('scope', 'היקף ההסכם, המקורות שהוא מכסה', 'mou-scope', scopeBoxes);

    const validInput = createElement('input', { class: 'field__control', id: 'mou-valid', type: 'date' });
    validInput.value = view.mouForm.valid_until;
    validInput.addEventListener('input', () => { view.mouForm.valid_until = validInput.value; });
    const validField = wrapField('valid_until', 'בתוקף עד', 'mou-valid', validInput);

    const registerMou = createElement('button', { class: 'btn btn--primary', type: 'button' }, 'רישום הסכם');
    registerMou.addEventListener('click', () => act('BE-05', 'register_mou', {
      institute_id: view.mouForm.institute_id,
      scope: [...view.mouForm.scope],
      valid_until: view.mouForm.valid_until,
      covers_content_contribution: true,
    }));

    const registerInstitute = createElement('button', { class: 'btn', type: 'button' }, 'רישום מכון');
    registerInstitute.addEventListener('click', () => act('BE-05', 'register_institute', {}));

    // מתג האכיפה. 2.4 דורש שיוצג מה ייחסם, ולא רק המתג עצמו.
    const toggle = createElement('button', { class: 'btn', type: 'button' }, 'החלפת מצב האכיפה');
    toggle.addEventListener('click', () => act('BE-06', 'set_enforce', {}));

    return createElement('div', {}, [
      rows.length > 0
        ? createElement('table', { class: 'table' }, rows)
        : createElement('p', { class: 'empty' }, 'אין הסכמים רשומים.'),
      instituteField,
      scopeField,
      validField,
      createElement('p', { class: 'text-sm text-muted' },
        'הדלקת האכיפה חוסמת את מסך המטייל כל עוד המסלול אינו נעול.'),
      createElement('div', { class: 'btn-row' }, [registerInstitute, registerMou, toggle]),
    ]);
  }

  function readinessPanel() {
    const rows = view.readiness.map((condition) => createElement('tr', {}, [
      createElement('td', {}, condition.condition),
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
      createElement('table', { class: 'table' }, rows),
      createElement('div', { class: 'btn-row' }, [lock]),
    ]);
  }

  function metricsPanel() {
    const rows = view.metrics.map((metric) => createElement('tr', {}, [
      createElement('td', {}, metric.metric),
      createElement('td', {}, metric.name),
      createElement('td', {}, String(metric.value)),
      createElement('td', {}, [
        createElement('span', { class: metric.passes ? 'status status--approved' : 'status status--rejected' },
          metric.passes ? 'עובר' : 'לא עובר'),
        createElement('span', { class: 'list__meta' }, `מדגם ${metric.sample}`),
      ]),
    ]));

    const exportButton = createElement('button', { class: 'btn', type: 'button' }, 'ייצוא');
    exportButton.addEventListener('click', () => act('BE-07', 'export', {}));

    return createElement('div', {}, [
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
      children.push(createElement('div', { class: 'message message--done' },
        `הפעולה ${view.message} נשלחה.`));
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
