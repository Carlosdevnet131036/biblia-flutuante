// Versão web (iPhone / navegador) da ponte window.api usada pelo Electron.
// No Electron, preload.js já define window.api e este arquivo não faz nada.
(() => {
  if (window.api) return;
  document.documentElement.classList.add('web');

  const SOURCES = {
    ACF: 'https://raw.githubusercontent.com/thiagobodruk/biblia/master/json/acf.json',
    NVI: 'https://raw.githubusercontent.com/thiagobodruk/biblia/master/json/nvi.json',
    AA: 'https://raw.githubusercontent.com/thiagobodruk/biblia/master/json/aa.json',
    KJV: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json',
  };
  const KEYS = ['leitura', 'destaques', 'notas', 'temas', 'estudos', 'votos'];
  const DATA = 'biblia-flutuante:dados';
  const PREV = 'biblia-flutuante:dados-anterior';
  const STATE = 'biblia-flutuante:janela';
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  };
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  let data = ls.get(DATA);
  let error = null;
  if (data !== null && !object(data)) { error = 'Não foi possível ler os dados salvos.'; data = ls.get(PREV); }
  data = object(data) ? data : {};
  let preserved = false;

  function replace(next) {
    if (!object(next) || Object.keys(next).some(k => !KEYS.includes(k))) throw new Error('Dados inválidos.');
    if (!preserved && Object.keys(data).length) { ls.set(PREV, data); preserved = true; }
    ls.set(DATA, next);
    data = structuredClone(next);
  }

  // ---------- Ajuste da tela: o layout tem tamanho fixo e é escalado para caber ----------
  const state = Object.assign({ compact: true }, ls.get(STATE) || {});
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  function fit() {
    const html = document.documentElement;
    if (!probe.isConnected && document.body) document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const inset = p => parseFloat(cs[p]) || 0;
    const top = inset('paddingTop'), bottom = inset('paddingBottom');
    const left = inset('paddingLeft'), right = inset('paddingRight');
    const vw = window.innerWidth - left - right, vh = window.innerHeight - top - bottom;
    let w = 800, h = 540, s;
    if (state.compact) {
      // Uma página: ocupa toda a largura e estica a altura até o fim da tela.
      w = 440;
      s = Math.min(vw / w, vh / 560);
      h = Math.max(560, Math.floor(vh / s));
    } else s = Math.min(vw / w, vh / h);
    const changed = html.style.getPropertyValue('--app-h') !== h + 'px';
    html.style.setProperty('--app-h', h + 'px');
    html.style.zoom = s;
    html.style.marginLeft = (left + (vw - w * s) / 2) / s + 'px';
    html.style.marginTop = (top + Math.max(0, (vh - h * s) / 2)) / s + 'px';
    return changed;
  }
  // Ao girar a tela, reorganiza o texto nas páginas com a nova altura.
  let refit;
  function onResize() {
    clearTimeout(refit);
    refit = setTimeout(() => {
      if (fit() && typeof bible !== 'undefined' && bible && typeof openAt === 'function') openAt(true);
    }, 200);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // ---------- Gestos: deslizar para virar a página ----------
  let touch = null;
  document.addEventListener('touchstart', e => {
    touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!touch || !e.target.closest || !e.target.closest('#spread')) return;
    const t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (String(window.getSelection && window.getSelection()).length) return;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: dx < 0 ? 'ArrowRight' : 'ArrowLeft', bubbles: true }));
  }, { passive: true });

  function pickFile() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = () => resolve(input.files[0] || null);
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  }

  window.api = {
    state: async () => { fit(); return { onTop: false, opacity: 1, zoom: 1, compact: !!state.compact }; },
    minimize() {}, close() {},
    toggleTop: async () => false,
    opacity: async v => v,
    zoom: async z => z,
    compact: async v => {
      state.compact = !!v; ls.set(STATE, state);
      setTimeout(fit, 0);
      return state.compact;
    },
    readData: () => ({ data, error, recovered: false }),
    saveData(key, value) {
      try {
        if (!KEYS.includes(key)) throw new Error('Tipo de dado desconhecido.');
        replace({ ...data, [key]: value });
        error = null;
        return { ok: true };
      } catch (err) { return { ok: false, error: err.message }; }
    },
    async exportBackup(snapshot) {
      try {
        const text = JSON.stringify({ format: 'biblia-flutuante', version: 1, savedAt: new Date().toISOString(), data: snapshot }, null, 2);
        const name = `Biblia-backup-${new Date().toISOString().slice(0, 10)}.json`;
        const file = new File([text], name, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: name }); return { ok: true }; }
          catch (err) { if (err.name === 'AbortError') return { canceled: true }; }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        return { ok: true };
      } catch (err) { return { error: err.message }; }
    },
    async importBackup() {
      const file = await pickFile();
      if (!file) return { canceled: true };
      try {
        if (file.size > 10 * 1024 * 1024) throw new Error('O backup excede o limite de 10 MB.');
        const backup = JSON.parse(await file.text());
        if (!backup || backup.format !== 'biblia-flutuante' || backup.version !== 1)
          throw new Error('Este arquivo não é um backup compatível da Bíblia Flutuante.');
        if (!confirm('Substituir seus dados pelo backup selecionado?\n\nUma cópia dos dados atuais será preservada.')) return { canceled: true };
        if (Object.keys(data).length) ls.set(PREV, data);
        preserved = true;
        replace(backup.data);
        return { ok: true, data: backup.data };
      } catch (err) { return { error: err.message }; }
    },
    async loadBible(version) {
      const url = SOURCES[version];
      if (!url) throw new Error('Versão desconhecida');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Falha ao baixar (${res.status})`);
      const text = (await res.text()).replace(/^﻿/, '');
      return JSON.parse(text).map(b => b.chapters);
    },
    async loadXrefs() {
      const res = await fetch('data/referencias.json');
      if (!res.ok) throw new Error(`Falha ao carregar referências (${res.status})`);
      return res.json();
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Controles que só fazem sentido na janela do Windows.
    for (const id of ['bMin', 'bClose', 'bTop']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    for (const id of ['bOpacity', 'bZoom']) { const row = document.getElementById(id)?.closest('.setting-row'); if (row) row.style.display = 'none'; }
    fit();
  });

  if ('serviceWorker' in navigator && location.protocol === 'https:')
    navigator.serviceWorker.register('sw.js').catch(() => {});
})();
