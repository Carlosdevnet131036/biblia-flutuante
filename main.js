const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { DataStore, encode, decode, atomicWrite } = require('./data-store');
// Use software rendering for consistent behavior across Windows graphics drivers.
app.disableHardwareAcceleration();
if (process.platform === 'win32') app.setAppUserModelId('br.bibliaflutuante.desktop');
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on('second-instance', () => { if (win) { win.restore(); win.show(); win.focus(); } });

const BASE_W = 800;
const BASE_H = 540;
const SOURCES = {
  ACF: 'https://raw.githubusercontent.com/thiagobodruk/biblia/master/json/acf.json',
  NVI: 'https://raw.githubusercontent.com/thiagobodruk/biblia/master/json/nvi.json',
  AA: 'https://raw.githubusercontent.com/thiagobodruk/biblia/master/json/aa.json',
  KJV: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json',
};

const dataDir = () => app.getPath('userData');
const stateFile = () => path.join(dataDir(), 'janela.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; }
}
function writeState(patch) {
  const st = { ...readState(), ...patch };
  try { fs.writeFileSync(stateFile(), JSON.stringify(st)); } catch {}
  return st;
}

function positionIsVisible(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number') return false;
  return screen.getAllDisplays().some(({ workArea: a }) =>
    x >= a.x - 50 && y >= a.y - 50 && x < a.x + a.width - 100 && y < a.y + a.height - 100);
}

let win;
let userData;
const windowSize = (compact, zoom) => ({ width: Math.round((compact ? 440 : BASE_W) * zoom), height: Math.round((compact ? 640 : BASE_H) * zoom) });
function resizeWindow(compact, zoom) {
  const area = screen.getDisplayMatching(win.getBounds()).workArea;
  const z = Math.min(zoom, area.width / (compact ? 440 : BASE_W), area.height / (compact ? 640 : BASE_H));
  const fitted = windowSize(compact, z);
  win.setResizable(true);
  win.setSize(fitted.width, fitted.height);
  win.setResizable(false);
  win.webContents.setZoomFactor(z);
  const [x, y] = win.getPosition();
  win.setPosition(Math.max(area.x, Math.min(x, area.x + area.width - fitted.width)), Math.max(area.y, Math.min(y, area.y + area.height - fitted.height)));
}

function createWindow() {
  const st = readState();
  const zoom = st.zoom || 1;
  const onTop = st.onTop ?? true;
  const opts = {
    ...windowSize(st.compact, zoom),
    show: false,
    frame: false,
    // Native transparent windows can remain invisible on Windows even when the
    // renderer has loaded. Keep the surface opaque; setOpacity still works.
    transparent: false,
    resizable: false,
    maximizable: false,
    hasShadow: false,
    title: 'Bíblia',
    icon: path.join(__dirname, 'assets', 'biblia.ico'),
    backgroundColor: '#211a14',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false },
  };
  if (positionIsVisible(st.x, st.y)) {
    const a = screen.getDisplayNearestPoint({ x: st.x, y: st.y }).workArea;
    opts.x = Math.max(a.x, Math.min(st.x, a.x + a.width - opts.width));
    opts.y = Math.max(a.y, Math.min(st.y, a.y + a.height - opts.height));
  }
  else {
    const a = screen.getPrimaryDisplay().workArea;
    opts.x = a.x + a.width - opts.width - 24;
    opts.y = a.y + Math.max(0, Math.round((a.height - opts.height) / 2));
  }

  win = new BrowserWindow(opts);
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.setAlwaysOnTop(onTop, 'floating');
  if (st.opacity) win.setOpacity(st.opacity);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('did-finish-load', () => { resizeWindow(st.compact, zoom); win.show(); win.restore(); win.focus(); });

  win.on('moved', () => {
    const [x, y] = win.getPosition();
    writeState({ x, y });
  });
}

ipcMain.handle('win:state', () => {
  const st = readState();
  return { onTop: win.isAlwaysOnTop(), opacity: st.opacity || 1, zoom: st.zoom || 1, compact: !!st.compact };
});
ipcMain.on('win:minimize', () => win.minimize());
ipcMain.on('win:close', () => win.close());
ipcMain.handle('win:toggleTop', () => {
  const v = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(v, 'floating');
  writeState({ onTop: v });
  return v;
});
ipcMain.handle('win:opacity', (_e, v) => {
  if (!Number.isFinite(v) || v < 0.4 || v > 1) throw new Error('Opacidade inválida');
  win.setOpacity(v);
  writeState({ opacity: v });
  return v;
});
ipcMain.handle('win:zoom', (_e, z) => {
  if (![1, 0.85, 0.72, 1.15].includes(z)) throw new Error('Tamanho inválido');
  resizeWindow(readState().compact, z);
  writeState({ zoom: z });
  return z;
});
ipcMain.handle('win:compact', (_e, compact) => {
  compact = !!compact;
  resizeWindow(compact, readState().zoom || 1);
  writeState({ compact });
  return compact;
});
ipcMain.on('data:read', e => {
  e.returnValue = { data: userData.data, error: userData.error, recovered: userData.recovered };
});
ipcMain.on('data:save', (e, key, value) => {
  try { userData.set(key, value); e.returnValue = { ok: true }; }
  catch (err) { e.returnValue = { ok: false, error: err.message }; }
});
ipcMain.handle('backup:export', async (_e, snapshot) => {
  const { validateData } = require('./data-store');
  try { validateData(snapshot); } catch (err) { return { error: err.message }; }
  const result = await dialog.showSaveDialog(win, {
    title: 'Exportar backup', defaultPath: path.join(app.getPath('documents'), `Biblia-backup-${new Date().toISOString().slice(0, 10)}.json`),
    filters: [{ name: 'Backup da Bíblia', extensions: ['json'] }],
  });
  if (result.canceled) return { canceled: true };
  try { atomicWrite(result.filePath, encode(snapshot)); return { ok: true }; }
  catch (err) { return { error: err.message }; }
});
ipcMain.handle('backup:import', async () => {
  const result = await dialog.showOpenDialog(win, { title: 'Restaurar backup', properties: ['openFile'], filters: [{ name: 'Backup da Bíblia', extensions: ['json'] }] });
  if (result.canceled) return { canceled: true };
  try {
    const file = result.filePaths[0];
    if (fs.statSync(file).size > 10 * 1024 * 1024) throw new Error('O backup excede o limite de 10 MB.');
    const data = decode(fs.readFileSync(file, 'utf8'));
    const confirm = await dialog.showMessageBox(win, { type: 'question', title: 'Restaurar backup',
      message: 'Substituir seus dados pelo backup selecionado?', detail: 'Suas anotações, estudos, votos e posição de leitura serão restaurados. Uma cópia dos dados atuais será preservada automaticamente.',
      buttons: ['Cancelar', 'Restaurar backup'], defaultId: 0, cancelId: 0 });
    if (confirm.response !== 1) return { canceled: true };
    userData.replace(data, true);
    return { ok: true, data };
  } catch (err) { return { error: err.message }; }
});

ipcMain.handle('bible:load', async (_e, version) => {
  const url = SOURCES[version];
  if (!url) throw new Error('Versão desconhecida');
  const file = path.join(dataDir(), `biblia-${version}.json`);
  let text;
  if (fs.existsSync(file)) {
    text = fs.readFileSync(file, 'utf8');
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao baixar (${res.status})`);
    text = (await res.text()).replace(/^﻿/, '');
    JSON.parse(text); // valida antes de salvar
    fs.writeFileSync(file, text);
  }
  return JSON.parse(text.replace(/^﻿/, '')).map(b => b.chapters);
});

let xrefs = null;
ipcMain.handle('xrefs:load', () => {
  if (!xrefs) xrefs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'referencias.json'), 'utf8'));
  return xrefs;
});

if (primaryInstance) app.whenReady().then(() => { userData = new DataStore(dataDir()); createWindow(); });
app.on('window-all-closed', () => app.quit());
