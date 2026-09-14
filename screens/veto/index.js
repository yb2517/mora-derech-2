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

export function create({ host, from, reference, send }) {
  // מצב התצוגה של המסך, ולא מצב עסקי: מה פתוח, מה נבחר, ומה נטען.
  const view = { site: null, gate: null, items: [], approvals: [], open: null, note: '', warned: false, done: null };

  const errorText = (error) => humanError(reference?.error_human_text, error);

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
    const gate = await ask('BE-06', 'get_gate', {});
    if (!gate.ok) return showError(gate.error);
    view.site = gate.data?.site ?? null;
    view.gate = gate.data?.gate ?? null;

    const siteId = view.site?.site_id;
    const [items, approvals] = await Promise.all([
      ask('BE-05', 'listItems', { site_id: siteId }),
      ask('BE-05', 'listApprovals', { site_id: siteId }),
    ]);

    if (!items.ok) return showError(items.error);
    if (!approvals.ok) return showError(approvals.error);

    view.items = items.data?.items ?? [];
    view.approvals = approvals.data?.approvals ?? [];
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

    // המצב באמת השתנה משלב 3, ולכן המסך נטען מחדש ואינו מצייר
    // מזיכרונו: הפריט, המונים, פס השערים ויומן ההחלטות מגיעים
    // כולם מהרשומות. זה גם מה שמראה לחוקר את הרשומה שנוצרה,
    // כפי שבדיקת הקבלה של השלב דורשת.
    view.warned = false;
    view.note = '';
    view.open = null;
    view.done = response.data;
    await load();
  }

  // --- תצוגה ---

  // פס השערים. BL-08: השער פתוח כאשר המסלול נעול ו-M-06 גדול או
  // שווה 1, ושני התנאים מוצגים בנפרד כדי שיהיה ברור מה חסר. המצב
  // מגיע מ-BE-06 ואינו מחושב כאן.
  function gateStrip() {
    const gate = view.gate;
    const open = gate?.open === true;
    return createElement('div', { class: 'gate' }, [
      createElement('strong', {}, 'שער B'),
      createElement('span', { class: open ? 'gate__lock gate__lock--open' : 'gate__lock' },
        open ? 'פתוח' : 'חסום'),
      createElement('span', { class: 'text-sm' },
        gate?.locked ? 'המסלול נעול' : 'המסלול פתוח'),
      createElement('span', { class: 'text-sm' },
        `M-06: ${gate?.m06 ?? 0}${gate?.m06 >= 1 ? ', הסכם חתום' : ', אין הסכם חתום'}`),
      createElement('span', { class: 'text-sm text-muted' },
        gate?.enforced ? 'האכיפה דולקת' : 'האכיפה כבויה'),
      createElement('span', { class: 'text-sm' }, view.site?.name ?? ''),
    ]);
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
      createElement('textarea', { class: 'field__control', id: 'veto-note', rows: '2' }),
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
    if (view.done) {
      // הודעת האישור הקצרה של usecase-f-07 צעד 11, ובה מה שבאמת
      // קרה: המעבר שנרשם, ולא "הפעולה נשלחה".
      children.push(createElement('div', { class: 'message message--done' },
        `${STATE_LABEL[view.done.from_status] ?? view.done.from_status}`
        + ` ${STATE_LABEL[view.done.status] ?? view.done.status}, ונרשם ביומן ההחלטות.`));
      view.done = null;
    }
    children.push(createElement('div', { class: 'layout layout--split' }, [items, log]));

    host.replaceChildren(...children);
  }

  load();
  return { reload: load };
}
