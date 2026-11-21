(function (root) {
  const normalize = text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim();
  const short = 'gn ex lv nm dt js jz rt 1sm 2sm 1rs 2rs 1cr 2cr ed ne et jo sl pv ec ct is jr lm ez dn os jl am ob jn mq na hc sf ag zc ml mt mc lc joao at rm 1co 2co gl ef fp cl 1ts 2ts 1tm 2tm tt fm hb tg 1pe 2pe 1jo 2jo 3jo jd ap'.split(' ');
  function reference(query, names, english) {
    const match = normalize(query).match(/^(.+?)\s*(\d+)(?:\s*[: ,]\s*(\d+))?$/);
    if (!match) return null;
    const name = match[1].replace(/\s/g, '');
    // “Jo” conventionally means Jó; accept the explicit and familiar “João” / “Joao”.
    const b = names.findIndex((n, i) => [normalize(n).replace(/\s/g, ''), normalize(english[i]).replace(/\s/g, ''), short[i]].includes(name));
    if (b < 0) return null;
    return { b, c: +match[2] - 1, v: match[3] ? +match[3] - 1 : 0 };
  }
  function createIndex(bible) {
    return bible.flatMap((chapters, b) => chapters.flatMap((verses, c) => verses.map((text, v) => ({ b, c, v, text, normalized: normalize(text) }))));
  }
  function search(index, bible, query, names, english, limit = 50) {
    const q = normalize(query);
    if (!q) return { results: [], total: 0 };
    const target = reference(q, names, english);
    if (target) {
      const text = bible[target.b]?.[target.c]?.[target.v];
      return { results: text === undefined ? [] : [{ ...target, text }], total: text === undefined ? 0 : 1, invalidReference: text === undefined };
    }
    const words = q.split(/\s+/);
    const found = index.filter(row => words.every(word => row.normalized.includes(word)));
    return { results: found.slice(0, limit), total: found.length };
  }
  const api = { normalize, reference, createIndex, search };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BibleSearch = api;
})(typeof globalThis === 'object' ? globalThis : this);
