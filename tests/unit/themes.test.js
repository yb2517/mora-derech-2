// Unit של DESIGN-01: שלוש ערכות הצבע. משימה 1 בתוכנית שלב 9.
//
// המקור: מפה 3.3 שורת DESIGN-01 בנוסח 3.15 (פער 92): "שלוש ערכות צבע
// על אותם tokens ... ומתג ערכה שמשנה רק את data-theme"; שורת שלב 9
// במפה 7 ובמסמך הבנייה 6: "ערכת ראיית הלילה בלי לבן, כחול, ירוק או
// צהוב"; ו-doc-design-system-v1, בדיקות קבלה 2 ו-3.
//
//   node tests/unit/themes.test.js

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createChecker } from '../helpers/assert.js';

const { check, report } = createChecker('DESIGN-01 themes');

const css = readFileSync(fileURLToPath(new URL('../../design/tokens.css', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return null;
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const root = block(':root');
const dark = block('[data-theme="dark"]');
const night = block('[data-theme="night"]');

check('שלוש הערכות קיימות', [root !== null, dark !== null, night !== null], [true, true, true]);

// הערכה שמתחלפת: צבעים וצל. כל מאפיין צבע של :root מוגדר גם בשתי
// הערכות האחרות, ואף מאפיין אחר אינו מוגדר בהן, כך שהחלפת ערכה אינה
// יכולה לשנות מידה, גופן או מרווח.
const isColor = (value) => /^#[0-9a-f]{3,8}$/i.test(value) || /^rgba?\(/i.test(value);
const themed = Object.keys(root).filter((name) => isColor(root[name]) || name === 'shadow-raised').sort();
check('23 מאפייני צבע ועוד הצל בערכה הבהירה', themed.length, 24);
check('הערכה הכהה מגדירה את אותם מאפיינים בדיוק', Object.keys(dark).sort(), themed);
check('ערכת ראיית הלילה מגדירה את אותם מאפיינים בדיוק', Object.keys(night).sort(), themed);
check('הערכה הכהה שונה מהבהירה בכל צבע רקע וטקסט',
  ['canvas', 'surface', 'ink', 'clay'].every((name) => dark[name] !== root[name]), true);

// ראיית לילה: אדום או כמעט שחור בלבד. ערוץ הירוק והכחול אינם עולים על
// 0.6 מהאדום, ולכן אין לבן, צהוב, ירוק או כחול. זו בדיקת הקבלה 3 של
// ערכת העיצוב, כקוד.
function channels(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
const notRed = Object.entries(night)
  .filter(([name]) => name !== 'shadow-raised')
  .filter(([, value]) => {
    if (!/^#/.test(value)) return true;
    const [r, g, b] = channels(value);
    return g > r * 0.6 || b > r * 0.6;
  })
  .map(([name, value]) => `${name}: ${value}`);
check('בראיית לילה כל צבע אדום או כמעט שחור', notRed, []);
check('בראיית לילה אין צל', night['shadow-raised'], 'none');
check('בראיית לילה המסך המחשיך אטום, ותמונות אינן נראות', night.scrim, night.canvas);

report();
