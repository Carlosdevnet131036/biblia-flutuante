(function (root) {
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
  function parse(text) {
    const result = [], seen = new Set();
    for (const raw of text.split(',')) {
      const label = raw.trim().replace(/\s+/g, ' '), key = normalize(label);
      if (!label || seen.has(key)) continue;
      if (label.length > 40) throw new Error('Use até 40 caracteres por tema.');
      seen.add(key); result.push(label);
    }
    if (result.length > 8) throw new Error('Use até 8 temas por versículo.');
    return result;
  }
  function catalog(topics) {
    const labels = new Map();
    for (const list of Object.values(topics)) for (const label of list) {
      const key = normalize(label);
      if (!labels.has(key)) labels.set(key, label);
    }
    return [...labels].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }
  function matches(entry, filters) {
    const topics = entry.topics || [];
    if (filters.topic === 'none' && topics.length) return false;
    if (filters.topic?.startsWith('topic:') && !topics.some(t => normalize(t) === filters.topic.slice(6))) return false;
    if (filters.color === 'none' && entry.color) return false;
    if (filters.color && filters.color !== 'none' && filters.color !== entry.color) return false;
    const text = normalize([entry.reference, entry.text, entry.note, ...topics].join(' '));
    return normalize(filters.query || '').split(' ').every(word => text.includes(word));
  }
  const api = { normalize, parse, catalog, matches };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NoteTopics = api;
})(typeof globalThis === 'object' ? globalThis : this);
