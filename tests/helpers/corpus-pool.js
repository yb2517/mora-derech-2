// מאגר מועמדים מהקורפוס האמיתי, לבדיקות של השליפה. משימה 4 בתוכנית
// שלב 8.
//
// המנוע הדו שלבי (מפה BL-05 בנוסח 3.12) דורש מונח ייחודי: מונח
// שמופיע בפחות מעשירית ממשפטי המאגר. במאגר של שניים או שלושה פריטים
// סינתטיים אין מונח כזה, ולכן כל שאלה מקבלת הימנעות, בצדק. בדיקה
// שצריכה שליפה מוצלחת מקבלת כאן את 19 הטקסטים של
// data/corpus/jaffa-01.json כפריטים מאושרים, באתר ובמקור שלה.
// אלה נתוני בדיקה בזיכרון בלבד: הם אינם נכתבים לשום מסד.

import corpus from '../../data/corpus/jaffa-01.json' with { type: 'json' };

/**
 * @param {object} options
 * @param {string} options.site_id האתר של הבדיקה.
 * @param {string} options.source_id המקור של הבדיקה, תחת ההסכם שלה.
 * @param {string} [options.status] מצב הפריטים, approved כברירת מחדל.
 * @param {string} [options.prefix] תחילית למזהה, כדי לא להתנגש בזריעה.
 * @returns {object[]}
 */
export function corpusItems({ site_id: siteId, source_id: sourceId, status = 'approved', prefix = '' }) {
  return corpus.items.map((row) => ({
    item_id: `${prefix}${row.item_id}`,
    site_id: siteId,
    stop_id: row.stop_id,
    name: row.name,
    text: row.text,
    source_id: sourceId,
    page: Number(row.page),
    word_count: Number(row.word_count),
    audience: row.audience,
    status,
  }));
}

/** משפטי הטקסט של פריט בקורפוס, לפי החלוקה של BE-04. */
export function corpusSentence(itemId, index) {
  const row = corpus.items.find((item) => item.item_id === itemId);
  return String(row?.text ?? '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)[index];
}
