// DOM מינימלי לבדיקות המסכים. משימה 5 בתוכנית שלב 2.
//
// למה הוא קיים: בלעדיו אין דרך להריץ מסך במערך הבדיקות, ומסך בלי
// בדיקה הוא מסך שנבדק ביד בכל שינוי. מסמך הבנייה חוק 9 דורש בדיקה
// יחד עם הקוד.
//
// למה הוא כזה קטן: הוא מממש בדיוק את מה שהמסכים משתמשים בו, ולא
// יותר. אין כאן פריסה, אין סגנון ואין אירועים מלבד click ו-input.
// מה שהוא אינו יכול לבדוק, למשל שהטקסט נראה, נבדק בדפדפן ומדווח
// ככזה. הוא יושב תחת tests/ ואינו קוד המערכת, ולכן מבחני המבנה
// אינם סורקים אותו.
//
// המנוע של הבוררים מכיר צירוף אחד: רצף חלקים מופרדים ברווח, וכל
// חלק הוא שם תגית או .מחלקה. זה כל מה שהמסכים שולחים.

class Node {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.parent = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.disabled = false;
    this.value = '';
    this.text = null;
  }

  get classList() {
    return String(this.attributes.get('class') ?? '').split(/\s+/).filter(Boolean);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }

  prepend(...nodes) {
    for (const node of nodes.reverse()) {
      node.parent = this;
      this.children.unshift(node);
    }
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  get textContent() {
    if (this.text !== null) return this.text;
    return this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this.text = String(value);
    this.children = [];
  }

  addEventListener(name, handler) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(handler);
  }

  dispatch(name) {
    for (const handler of this.listeners.get(name) ?? []) handler({ target: this });
  }

  /** לחיצה. כפתור מנוטרל אינו מגיב, בדיוק כמו בדפדפן. */
  click() {
    if (this.disabled) return;
    this.dispatch('click');
  }

  /** הקלדה: קובעת ערך ומשדרת input, כמו משתמש שמקליד. */
  type(value) {
    this.value = String(value);
    this.dispatch('input');
  }

  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  matchesPart(part) {
    if (part.startsWith('.')) return this.classList.includes(part.slice(1));
    return this.tagName === part;
  }

  querySelectorAll(selector) {
    const parts = selector.trim().split(/\s+/);
    let pool = this.descendants();
    for (const [index, part] of parts.entries()) {
      const matched = pool.filter((node) => node.matchesPart(part));
      pool = index === parts.length - 1
        ? matched
        : matched.flatMap((node) => node.descendants());
    }
    return pool;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class TextNode extends Node {
  constructor(value) {
    super('#text');
    this.text = String(value);
  }
}

/**
 * מתקין document גלובלי לבדיקה, ומחזיר את השורש ופונקציית ניקוי.
 * הבדיקה מקבלת host כמו שנקודת הכניסה מייצרת אותו.
 */
export function installDom() {
  const previous = globalThis.document;

  globalThis.document = {
    createElement: (tag) => new Node(tag),
    createTextNode: (value) => new TextNode(value),
  };

  return {
    host: new Node('div'),
    restore() {
      globalThis.document = previous;
    },
  };
}
