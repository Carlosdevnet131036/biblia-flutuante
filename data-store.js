const fs = require('node:fs');
const path = require('node:path');

const KEYS = ['leitura', 'destaques', 'notas', 'temas', 'estudos', 'votos'];
const object = v => v && typeof v === 'object' && !Array.isArray(v);
function validateData(data) {
  if (!object(data) || Object.keys(data).some(k => !KEYS.includes(k))) throw new Error('Dados de backup inválidos.');
  if (data.leitura !== undefined) {
    const s = data.leitura;
    if (!object(s) || !['ACF', 'NVI', 'AA', 'KJV'].includes(s.version) ||
      !['light', 'sepia', 'dark'].includes(s.theme) ||
      !['book', 'chapter', 'first'].every(k => Number.isInteger(s[k]) && s[k] >= 0) || s.book > 65 ||
      !Number.isFinite(s.fs) || s.fs < 12 || s.fs > 22) throw new Error('Posição de leitura inválida.');
  }
  for (const key of ['notas', 'destaques', 'temas']) {
    if (data[key] === undefined) continue;
    if (!object(data[key])) throw new Error('Anotações inválidas.');
    for (const [k, v] of Object.entries(data[key])) {
      const parts = k.match(key !== 'destaques' ? /^(\d+)\.(\d+)\.(\d+)$/ : /^(\d+):(\d+)$/);
      if (!parts || +parts[1] > 65 || +parts[2] > 149 || (key !== 'destaques' && +parts[3] > 175)) throw new Error('Referência inválida.');
      if (key === 'notas' && typeof v !== 'string') throw new Error('Nota inválida.');
      if (key === 'temas' && (!Array.isArray(v) || v.length > 8 || v.some(t => typeof t !== 'string' || !t.trim() || t.length > 40 || t.includes(',')))) throw new Error('Temas inválidos.');
      if (key === 'destaques' && (!object(v) || Object.entries(v).some(([i, c]) => !/^\d+$/.test(i) || +i > 175 || !['y', 'g', 'r'].includes(c)))) throw new Error('Marcação inválida.');
    }
  }
  if (data.estudos !== undefined && (!Array.isArray(data.estudos) || data.estudos.some(s =>
    !object(s) || !Number.isFinite(s.id) || !Number.isFinite(s.created) ||
    typeof s.title !== 'string' || typeof s.text !== 'string'))) throw new Error('Estudos inválidos.');
  if (data.votos !== undefined && (!object(data.votos) || !['to', 'date', 'text'].every(k => typeof data.votos[k] === 'string'))) throw new Error('Votos inválidos.');
  return data;
}
function encode(data) { return JSON.stringify({ format: 'biblia-flutuante', version: 1, savedAt: new Date().toISOString(), data }, null, 2); }
function decode(text) {
  const backup = JSON.parse(text);
  if (backup.format !== 'biblia-flutuante' || backup.version !== 1) throw new Error('Este arquivo não é um backup compatível da Bíblia Flutuante.');
  return validateData(backup.data);
}
function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file + '.tmp', 'w');
  try { fs.writeFileSync(fd, text, 'utf8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(file + '.tmp', file);
}
class DataStore {
  constructor(dir) {
    this.file = path.join(dir, 'meus-dados.json');
    this.backup = path.join(dir, 'meus-dados.anterior.json');
    this.data = {};
    this.error = null;
    this.recovered = false;
    this.preserved = false;
    try {
      if (fs.existsSync(this.file)) this.data = decode(fs.readFileSync(this.file, 'utf8'));
    } catch (err) {
      try { this.data = decode(fs.readFileSync(this.backup, 'utf8')); this.recovered = true; }
      catch { this.error = 'Não foi possível recuperar os dados. Os arquivos originais foram preservados.'; }
    }
  }
  replace(data, forceBackup = false) {
    validateData(data);
    if (this.error) {
      if (!forceBackup) throw new Error(this.error);
      const suffix = '.danificado-' + Date.now();
      for (const file of [this.file, this.backup]) if (fs.existsSync(file)) fs.copyFileSync(file, file + suffix);
    }
    // Keep the pre-session contents, rather than replacing the recovery copy on every keystroke.
    if ((!this.preserved || forceBackup) && Object.keys(this.data).length) {
      atomicWrite(this.backup, encode(this.data)); this.preserved = true;
    }
    atomicWrite(this.file, encode(data));
    this.data = structuredClone(data);
    this.error = null;
  }
  set(key, value) {
    if (!KEYS.includes(key)) throw new Error('Tipo de dado desconhecido.');
    this.replace({ ...this.data, [key]: value });
  }
}
module.exports = { DataStore, validateData, encode, decode, atomicWrite };
