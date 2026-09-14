// FE-06: פאנל ה-Veto. משימה 5 בתוכנית שלב 2.
//
// המקור: מפה 3.3 שורת FE-06, מפה 4.4 (הפעולות שלו ואותן בלבד),
// doc-build-03-interfaces סעיף 2.1, ו-F-07.
//
// המסך שולח מעטפות דרך הכתובת האחת ואינו עושה דבר מלבד זה: הוא אינו
// מכיר את ה-Orchestrator, אינו מכיר את שכבת הנתונים, ואינו מכיר אף
// מודול. הוא מקבל בהזרקה את שם הפונה שלו, את ערכי ה-reference שהוא
// צריך, ואת הכתובת.
//
// שלושה דברים שהוא במפורש אינו עושה:
//   אינו מחליט אם מעבר מצב מותר. זו טבלת המעברים (מפה 2.2), והיא
//   יושבת בליבה. המסך מציג כפתור מנוטרל למצב הנוכחי, וזו תצוגה ולא
//   אכיפה: שליחה שאינה חוקית תיענה ב-E-TRANSITION-DENIED.
//
//   אינו מנסח שגיאות. הנוסח לאדם מגיע מטבלת ה-reference, מפתח
//   error_human_text, לפי BL-12.
//
//   אין בו פעולת "אפס למצב ההתחלה". מסמך הבנייה סעיף 2: הוכרע
//   10.09 שהיא יוצאת מהמערכת, ולכן היא אינה נבנית כאן מלכתחילה.

import { createElement, panel, statusTag, statusDot, humanError } from '../view.js';

// ארבעת שמות המצב באנגלית הם הקנוניים (מפה 2.2), והעברית ביאור
// במסך בלבד. זו הסיבה שהמיפוי הזה יושב כאן ולא בנתונים.
const STATE_LABEL = {
  draft: 'טיוטה',
  pending: 'הוגש',
  approved: 'מאושר',
  rejected: 'נדחה',
};

// ארבע פעולות המעבר של המסך, לפי מפה 4.4. הכפתור שמוביל למצב
// הנוכחי מנוטרל, ולכן לכל פעולה רשום המצב שהיא מייצרת.
const MOVES = [
  { action: 'submit', label: 'הגשה', leadsTo: 'pending', style: 'btn' },
  { action: 'approve', label: 'אישור', leadsTo: 'approved', style: 'btn btn--approve' },
  { action: 'reject', label: 'דחייה', leadsTo: 'rejected', style: 'btn btn--reject' },
  { action: 'return', label: 'החזרה', leadsTo: 'pending', style: 'btn' },
];

// הסיבות שהשער חסום, מ-BL-08, ומה שכתוב עליהן על המסך. המפתחות
// מגיעים מ-BE-06 (reasons), והנוסח כאן הוא ביאור לאדם, כמו שמות
// המצבים למעלה. אין כאן הכרעה: השער כבר הוכרע בליבה.
const GATE_REASON = {
  site_not_locked: 'המסלול אינו נעול',
  m06_zero: 'אין הסכם חתום שמכסה את כל המקורות',
};

export function create({ host, from, reference, send }) {
  // מצב התצוגה של המסך, ולא מצב עסקי: מה פתוח, מה נבחר, ומה נטען.
  const view = {
    site: null,
    gate: null,
    coverage: null,
    items: [],
    approvals: [],
    open: null,
    note: '',
    warned: false,
    moved: null,
  };

  const errorText = (error) => humanError(reference?.error_human_text, error);

  // מפתח בלי ערך מוכרע אינו הופך למספר מומצא: השדה פשוט אינו מוגבל
  // במסך, ו-BE-05 מחזיר E-REF-EMPTY אם תישלח בו הערה (חוק ברזל 5).
  const noteMax = typeof reference?.note_max_chars === 'number' ? reference.note_max_chars : null;

  // כל בקשה יוצאת מכאן, ולכן שם הפונה מוצהר בנקודה אחת.
  async function ask(module, action, payload) {
    return send({ from: from, module, action, payload });
  }

  function showError(error) {
    host.prepend(createElement('div', { class: 'message message--error' }, errorText(error)));
  }

  // --- טעינה ---

  async function load() {
    // מצב השער נטען ראשון, מפני שהתשובה נושאת את המסלול שהמסך עובד
    // עליו, ובלעדיו אין למה לבקש פריטים. גרסה 1 היא חד מסלולית.
    //
    // התשובה נושאת גם את מצב השער ואת הכיסוי, ושניהם מחושבים
    // ב-BE-06 (מפה 3.2). המסך מציג אותם ואינו מחשב אותם מחדש: שער
    // שמחושב בשני מקומות הוא שער שיכול להיפתח באחד ולהיחסם בשני.
    const gate = await ask('BE-06', 'get_gate', {});
    if (!gate.ok) return showError(gate.error);
    view.site = gate.data?.site ?? null;
    view.gate = gate.data?.gate ?? null;
    view.coverage = gate.data?.coverage ?? null;

    const siteId = view.site?.site_id;
    const [items, approvals] = await Promise.all([
      ask('BE-05', 'listItems', { site_id: siteId }),
      ask('BE-05', 'listApprovals', { site_id: siteId }),
    ]);

    if (!items.ok) return showError(items.error);
    if (!approvals.ok) return showError(approvals.error);

    view.items = items.data?.items ?? [];
    view.approvals = approvals.data?.approvals ?? [];

    // הפריט הפתוח נטען מחדש, כדי שהמצב שמוצג בו יהיה המצב שנשמר.
    if (view.open?.item?.item_id) {
      const again = await ask('BE-05', 'getItem', { item_id: view.open.item.item_id });
      view.open = again.ok ? again.data ?? null : null;
    }

    render();
  }

  async function openItem(itemId) {
    if (view.open?.item?.item_id === itemId) {
      view.open = null;
      view.note = '';
      view.warned = false;
      return render();
    }
    const response = await ask('BE-05', 'getItem', { item_id: itemId });
    if (!response.ok) return showError(response.error);
    view.open = response.data ?? null;
    view.note = '';
    view.warned = false;
    render();
  }

  // תזכורת רכה לפני דחייה בלי הערה, בלי חסימה. הכרעת 10.09, ולפי
  // doc-build-03-interfaces 2.1: תזכורת, לא תנאי.
  function needsReminder(action) {
    return action === 'reject' && view.note.trim() === '' && !view.warned;
  }

  async function move(action) {
    if (needsReminder(action)) {
      view.warned = true;
      return render();
    }
    const response = await ask('BE-05', action, {
      item_id: view.open?.item?.item_id,
      note: view.note,
    });
    if (!response.ok) return showError(response.error);

    view.warned = false;
    view.note = '';
    // מה שהתשובה אומרת, ולא מה שהמסך מניח שקרה: המצב הקודם והחדש
    // מגיעים מ-BE-05 (usecase-f-07 צעד 11).
    view.moved = {
      action,
      from_status: response.data?.from_status ?? null,
      status: response.data?.status ?? null,
    };

    // טעינה מחדש: הפריטים, יומן ההחלטות ומצב השער. מעבר מצב יכול
    // לשנות את שלושתם, ומסך שיעדכן רק את מה שהוא זוכר יתרחק
    // מהנתונים בלי שאיש ישים לב.
    await load();
  }

  // --- תצוגה ---

  // פס השערים, usecase-f-07 צעדים 11 ו-15. שלוש עובדות נפרדות
  // ומוצגות בנפרד: מצב השער, M-06, ומה שחסר כדי לפתוח. פער 34:
  // רישום הסכם מביא את M-06 ל-1, והשער נשאר חסום עד שהמסלול ננעל
  // (BL-08), והנעילה היא F-08. המסך אומר זאת ואינו מתחזה לשער פתוח.
  function gateStrip() {
    const gate = view.gate;
    const open = gate?.open === true;

    const children = [
      createElement('strong', {}, 'שער B'),
      createElement('span', { class: open ? 'gate__lock gate__lock--open' : 'gate__lock' },
        open ? 'הסכם חתום, השער פתוח' : 'השער חסום'),
      createElement('span', { class: 'text-sm' }, `M-06: ${gate?.m06 ?? 0}`),
    ];

    for (const reason of gate?.reasons ?? []) {
      children.push(createElement('span', { class: 'text-sm text-muted' },
        GATE_REASON[reason] ?? reason));
    }

    // זרימה ו3: כשהאכיפה כבויה המסך אומר זאת במפורש, כדי שאיש לא
    // יסיק ממסלול שעובד שהשער נפתח.
    if (gate && gate.enforced === false) {
      children.push(createElement('span', { class: 'text-sm text-muted' },
        'אכיפת שער B כבויה במפתח מפורש'));
    }

    children.push(createElement('span', { class: 'text-sm' }, view.site?.name ?? ''));

    return createElement('div', { class: 'gate' }, children);
  }

  function counts() {
    const byState = Object.keys(STATE_LABEL).map((state) => ({
      state,
      n: view.items.filter((item) => item.status === state).length,
    }));
    return createElement('div', { class: 'panel__counts' },
      byState.map(({ state, n }) => statusTag(state, `${STATE_LABEL[state]}: ${n}`)));
  }

  function itemRow(item) {
    const head = createElement('button', { class: 'list__head', type: 'button' }, [
      statusDot(item.status),
      createElement('span', {}, [
        createElement('span', { class: 'list__title' }, item.name),
        createElement('span', { class: 'list__meta' },
          `${item.stop_id}, עמוד ${item.page}, ${item.word_count} מילים`),
      ]),
      statusTag(item.status, STATE_LABEL[item.status]),
    ]);
    head.addEventListener('click', () => openItem(item.item_id));

    const row = createElement('li', { class: 'list__item' }, [head]);
    if (view.open?.item?.item_id === item.item_id) row.append(openBody());
    return row;
  }

  function openBody() {
    const item = view.open.item;
    const children = [
      createElement('p', { class: 'list__meta' },
        `מקור: ${view.open.source?.name ?? 'אין'}, עמוד ${item.page}`),
      createElement('blockquote', { class: 'quote' }, item.text),
    ];

    const field = createElement('div', { class: 'field' }, [
      createElement('label', { class: 'field__label', for: 'veto-note' }, 'הערה, רשות'),
      // הגבול מגיע מטבלת ה-reference ואינו כתוב כאן (BL-12, מפה 2.4,
      // המפתח note_max_chars). המסך מגביל את השדה, ו-BE-05 קוצץ מאחוריו.
      createElement('textarea', {
        class: 'field__control',
        id: 'veto-note',
        rows: '2',
        ...(noteMax === null ? {} : { maxlength: String(noteMax) }),
      }),
    ]);
    const control = field.querySelector('textarea');
    control.value = view.note;
    control.addEventListener('input', () => { view.note = control.value; });
    children.push(field);

    if (view.warned) {
      children.push(createElement('div', { class: 'message message--warn' },
        'דחייה בלי הערה. אפשר להוסיף נימוק, ואפשר ללחוץ שוב ולדחות בלעדיו.'));
    }

    children.push(createElement('div', { class: 'btn-row' }, MOVES.map((m) => {
      const button = createElement('button', { class: m.style, type: 'button' }, m.label);
      // הכפתור שמוביל למצב שהפריט כבר נמצא בו מנוטרל. תצוגה בלבד:
      // האכיפה היא של טבלת המעברים בליבה.
      if (item.status === m.leadsTo) button.disabled = true;
      button.addEventListener('click', () => move(m.action));
      return button;
    })));

    return createElement('div', { class: 'list__body' }, children);
  }

  function decisionLog() {
    if (view.approvals.length === 0) {
      return createElement('p', { class: 'empty' }, 'יומן ההחלטות ריק.');
    }
    return createElement('ol', { class: 'log' }, view.approvals.map((row) => createElement(
      'li', { class: 'log__entry' }, [
        createElement('time', { class: 'log__time' }, row.time),
        createElement('span', {}, `${row.action}: ${row.target}, מ-${STATE_LABEL[row.from_status] ?? row.from_status} ל-${STATE_LABEL[row.to_status] ?? row.to_status}`),
        row.note ? createElement('span', { class: 'list__meta' }, row.note) : null,
      ],
    )));
  }

  function render() {
    const list = view.items.length === 0
      ? createElement('p', { class: 'empty' }, 'אין פריטים במסלול.')
      : createElement('ul', { class: 'list' }, view.items.map(itemRow));

    const items = panel('פריטי המסלול', list, counts());
    const log = panel('יומן ההחלטות', decisionLog());

    const children = [gateStrip()];
    if (view.moved) {
      const label = MOVES.find((m) => m.action === view.moved.action)?.label ?? view.moved.action;
      const to = STATE_LABEL[view.moved.status] ?? view.moved.status;
      const fromLabel = STATE_LABEL[view.moved.from_status] ?? view.moved.from_status;
      children.push(createElement('div', { class: 'message message--done' },
        `${label}: הפריט עבר מ-${fromLabel} ל-${to}, ונרשם ביומן ההחלטות.`));
    }
    children.push(createElement('div', { class: 'layout layout--split' }, [items, log]));

    host.replaceChildren(...children);
  }

  load();
  return { reload: load };
}
