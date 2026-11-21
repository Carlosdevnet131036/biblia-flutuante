const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { DataStore, encode, decode } = require('../data-store');
const search = require('../search');
const topicTools = require('../note-topics');

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'biblia-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
test('an edit is durable immediately, without waiting for timers or closing', t => {
  const dir = temp(t), store = new DataStore(dir);
  store.set('notas', { '0.0.0': 'Últimas palavras digitadas' });
  assert.equal(new DataStore(dir).data.notas['0.0.0'], 'Últimas palavras digitadas');
});
test('the recovery copy preserves the pre-session data through multiple edits', t => {
  const dir = temp(t), store = new DataStore(dir);
  store.set('notas', { '0.0.0': 'Original' });
  const next = new DataStore(dir);
  next.set('notas', { '0.0.0': 'Editado' });
  next.set('notas', { '0.0.0': 'Editado de novo' });
  assert.equal(decode(fs.readFileSync(next.backup, 'utf8')).notas['0.0.0'], 'Original');
});
test('a damaged primary file is recovered from the previous copy', t => {
  const dir = temp(t), store = new DataStore(dir);
  store.set('notas', { '0.0.0': 'Preservado' });
  store.set('notas', { '0.0.0': 'Novo' });
  fs.writeFileSync(store.file, '{broken');
  const recovered = new DataStore(dir);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.data.notas['0.0.0'], 'Preservado');
});
test('invalid backups and invalid edits never replace good data', t => {
  const store = new DataStore(temp(t));
  store.set('notas', { '0.0.0': 'Seguro' });
  assert.throws(() => store.set('notas', { '0.0.0': 123 }));
  assert.equal(store.data.notas['0.0.0'], 'Seguro');
  assert.throws(() => decode('{"version":1,"data":{}}'));
  assert.throws(() => decode(encode({ estudos: [{ title: 'inválido' }] })));
  assert.throws(() => decode(encode({ notas: { '999.0.0': 'inválido' } })));
});
test('explicit restoration can recover damaged storage while retaining original files', t => {
  const dir = temp(t);
  fs.writeFileSync(path.join(dir, 'meus-dados.json'), 'damaged');
  const store = new DataStore(dir);
  assert.ok(store.error);
  store.replace({ notas: { '0.0.0': 'Restaurado' } }, true);
  assert.equal(new DataStore(dir).data.notas['0.0.0'], 'Restaurado');
  assert.ok(fs.readdirSync(dir).some(name => name.includes('.danificado-')));
});
test('export and restore round-trip accents, multiline notes, vows and highlights', t => {
  const store = new DataStore(temp(t));
  const data = { notas: { '0.0.0': 'Oração\nÉ fé.' }, destaques: { '0:0': { 0: 'y' } }, estudos: [{ id: 1, created: 1, title: 'Fé', text: 'Uma reflexão' }], votos: { to: 'Você', date: '', text: 'Até sempre' } };
  store.replace(decode(encode(data)));
  assert.deepEqual(new DataStore(path.dirname(store.file)).data, data);
});
test('topics survive immediate saving and backup restoration without changing note text', t => {
  const dir = temp(t), store = new DataStore(dir);
  store.set('notas', { '42.2.15': 'Minha reflexão original' });
  store.set('temas', { '42.2.15': ['Fé', 'Família'] });
  const restored = decode(encode(new DataStore(dir).data));
  assert.equal(restored.notas['42.2.15'], 'Minha reflexão original');
  assert.deepEqual(restored.temas['42.2.15'], ['Fé', 'Família']);
  // Existing backups remain valid, with no migration required for their note strings.
  assert.deepEqual(decode(encode({ notas: { '0.0.0': 'Antiga' } })), { notas: { '0.0.0': 'Antiga' } });
  assert.throws(() => store.set('temas', { '42.2.15': ['a'.repeat(41)] }));
  assert.throws(() => store.set('temas', { '42.2.15': 'Fé' }));
  assert.deepEqual(store.data.temas['42.2.15'], ['Fé', 'Família']);
});
test('topic entry deduplicates accents and case, handles commas, and validates limits', () => {
  assert.deepEqual(topicTools.parse(' Fé, fe, Família, ,  Vida   cristã, '), ['Fé', 'Família', 'Vida cristã']);
  assert.deepEqual(topicTools.parse(' , '), []);
  assert.throws(() => topicTools.parse('a'.repeat(41)));
  assert.throws(() => topicTools.parse('1,2,3,4,5,6,7,8,9'));
  assert.deepEqual(topicTools.catalog({ a: ['Fé', 'Família'], b: ['fe', 'Oração'] }).map(x => x[1]), ['Família', 'Fé', 'Oração']);
});
test('annotation filters combine topic, color and accent-insensitive text or reference', () => {
  const entry = { reference: 'João 3:16', text: 'Deus amou o mundo', note: 'Uma oração pela família', color: 'y', topics: ['Fé', 'Família'] };
  assert.equal(topicTools.matches(entry, { topic: 'topic:fe', color: 'y', query: 'ORACAO familia' }), true);
  assert.equal(topicTools.matches(entry, { query: 'joao 3:16' }), true);
  assert.equal(topicTools.matches(entry, { query: 'fé' }), true);
  assert.equal(topicTools.matches(entry, { topic: 'none' }), false);
  assert.equal(topicTools.matches(entry, { color: 'g' }), false);
  assert.equal(topicTools.matches({ ...entry, topics: [], color: undefined }, { topic: 'none', color: 'none' }), true);
});

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const names = vm.runInNewContext(script.slice(0, script.indexOf('const bk =')) + '; [BOOKS, BOOKS_EN]');
const bible = Array.from({ length: 66 }, () => [['Texto de exemplo']] );
bible[18] = [['O Senhor é meu pastor.']];
bible[42] = Array.from({ length: 3 }, () => Array.from({ length: 16 }, () => 'Porque Deus amou o mundo.'));
const index = search.createIndex(bible);
test('reference search accepts full names, abbreviations, accents and numbered books', () => {
  assert.deepEqual(search.reference('João 3:16', ...names), { b: 42, c: 2, v: 15 });
  assert.deepEqual(search.reference('Sl 23', ...names), { b: 18, c: 22, v: 0 });
  assert.deepEqual(search.reference('1 Co 13:4', ...names), { b: 45, c: 12, v: 3 });
  assert.deepEqual(search.reference('Genesis 1:1', ...names), { b: 0, c: 0, v: 0 });
  assert.equal(search.search(index, bible, 'João 3:16', ...names).results[0].text, 'Porque Deus amou o mundo.');
});
test('invalid references are reported and text search supports multiple accent-insensitive words', () => {
  assert.equal(search.search(index, bible, 'João 999:1', ...names).invalidReference, true);
  assert.equal(search.search(index, bible, 'João 0:1', ...names).invalidReference, true);
  assert.equal(search.search(index, bible, 'DEUS mundo', ...names, 5).total, 48);
  assert.equal(search.search(index, bible, 'DEUS mundo', ...names, 5).results.length, 5);
  assert.equal(search.search(index, bible, 'é pastor', ...names).total, 1);
  assert.equal(search.search(index, bible, '', ...names).total, 0);
});
test('renderer script parses and all static IDs are unique', () => {
  assert.doesNotThrow(() => new vm.Script(script));
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const staticIds = ids.filter(id => !['stSaved', 'stNote', 'stList', 'annList', 'annNote', 'annSaved'].includes(id));
  assert.equal(new Set(staticIds).size, staticIds.length);
});
