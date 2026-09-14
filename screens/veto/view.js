// עזרי בניית DOM לפאנל ה-Veto. משימה 5 בתוכנית שלב 2.
//
// אין כאן לוגיקה ואין כאן מעטפות: רק הרכבת אלמנטים עם מחלקות של
// DESIGN-01. שם המחלקה הוא כל מה שהקובץ הזה יודע על עיצוב, ולכן
// החלפת ערכת העיצוב אינה נוגעת בו (מפה 3.3 שורת DESIGN-01).
//
// הטקסט נכתב תמיד ב-textContent ולעולם לא ב-innerHTML: תוכן הפריט
// מגיע מהמכון, והוא נתון ולא סימון.

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
