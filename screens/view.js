// עזרי בניית DOM, משותפים לכל המסכים. נכתבו במשימה 5 והועברו לכאן
// במשימה 6, כשנכנס המסך השני.
//
// למה משותף ולא לכל מסך משלו: שלושה עותקים של אותה פונקציית בנייה
// הם שלושה מקומות שיכולים להיפרד זה מזה, ואז "כל מסך משתמש בערכת
// העיצוב" מפסיק להיות נכון בשקט.
//
// אין כאן לוגיקה ואין כאן מעטפות: רק הרכבת אלמנטים עם מחלקות של
// DESIGN-01. שם המחלקה הוא כל מה שהקובץ הזה יודע על עיצוב, ולכן
// החלפת ערכת העיצוב אינה נוגעת בו (מפה 3.3 שורת DESIGN-01).
//
// הטקסט נכתב תמיד ב-textContent ולעולם לא ב-innerHTML: תוכן הפריט
// מגיע מהמכון, והוא נתון ולא סימון.

import { ICON_SHAPES, ICON_VIEWBOX } from './icons.js';

/**
 * @param {string} tag
 * @param {Record<string, string>} attributes
 * @param {Node|string|Array<Node|string|null>} [children]
 */
export function createElement(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) element.setAttribute(name, value);
  }

  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined) continue;
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  return element;
}

/** פאנל עם כותרת, ותוספת רשות בשורת הכותרת. */
export function panel(title, body, extra = null) {
  return createElement('section', { class: 'panel' }, [
    createElement('div', { class: 'panel__head' }, [
      createElement('h2', {}, title),
      extra,
    ]),
    createElement('div', { class: 'panel__body' }, body),
  ]);
}

// שם המחלקה מורכב משם המצב הקנוני שחזר במעטפה, ולכן אין כאן טבלת
// תרגום ומצב חדש אינו דורש שורה כאן.
export function statusTag(state, label) {
  return createElement('span', { class: `status status--${state}` }, label);
}

export function statusDot(state) {
  return createElement('span', { class: `status-dot status-dot--${state}` });
}

// מספר, שעה, אחוז או קואורדינטה בתוך משפט עברי: נקרא משמאל לימין
// ומבודד מהטקסט שסביבו (פער 75, מפה 3.15 שורת DESIGN-01). המחלקה num
// היא של DESIGN-01; כאן רק העטיפה, כדי שכל מסך יעטוף באותה דרך.
//
// ביטוי שכולו משמאל לימין נעטף כיחידה אחת ולא ספרה ספרה: "M-06: 0",
// או זוג קואורדינטות. עטיפה של הספרה לבדה מפרידה אותה מהמזהה הלטיני
// שלפניה, וזוג שנעטף בשני חלקים מתהפך בתוך שורה עברית.
export function num(value) {
  return createElement('span', { class: 'num' }, String(value));
}

/**
 * הנוסח לאדם של קוד שגיאה, מתוך טבלת ה-reference.
 *
 * doc-error-human-text קובע שהערך בתבניות כמו "[שם השדה]" מוזרק
 * מ-error.data, כלומר מערך השגיאה (פער 8, בהכרעת בעלת הפרויקט
 * 14.09.2026). בלי ההזרקה המשפחה או החוקר רואים סוגריים מרובעים,
 * וזה לא נוסח אלא תבנית.
 *
 * המסך אינו מנסח כאן דבר: הוא ממלא מקום בנוסח שהטבלה נתנה. קוד
 * שאין לו נוסח מוצג כקוד, ולא מומצא לו טקסט.
 */
export function humanError(table, error) {
  const text = table?.[error?.code];
  if (typeof text !== 'string') return error?.code ?? '';

  const values = Object.values(error?.data ?? {}).filter(
    (value) => typeof value === 'string' || typeof value === 'number',
  );
  if (values.length === 0) return text;

  let index = 0;
  return text.replace(/\[[^\]]+\]/g, (placeholder) => (
    index < values.length ? String(values[index++]) : placeholder
  ));
}

// --- אייקונים (פער 99) ---
//
// הצורות ב-icons.js, מועתקות כלשונן מערכת העיצוב. הצבע בא מ-currentColor
// והמידה ממחלקת icon של DESIGN-01, ולכן האייקון מתחלף עם הערכה, גם
// בראיית לילה.
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(tag) {
  return typeof document.createElementNS === 'function'
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);
}

/** אייקון קווי מערכת העיצוב. מוסתר מקורא המסך: המשמעות במילים לצידו. */
export function createIcon(name) {
  const svg = svgElement('svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', ICON_VIEWBOX);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-icon', name);
  for (const [tag, attributes] of ICON_SHAPES[name] ?? []) {
    const part = svgElement(tag);
    for (const [key, value] of Object.entries(attributes)) part.setAttribute(key, value);
    svg.append(part);
  }
  return svg;
}
