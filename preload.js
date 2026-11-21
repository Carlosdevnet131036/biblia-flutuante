const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  state: () => ipcRenderer.invoke('win:state'),
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  toggleTop: () => ipcRenderer.invoke('win:toggleTop'),
  opacity: v => ipcRenderer.invoke('win:opacity', v),
  zoom: z => ipcRenderer.invoke('win:zoom', z),
  compact: v => ipcRenderer.invoke('win:compact', v),
  readData: () => ipcRenderer.sendSync('data:read'),
  saveData: (key, value) => ipcRenderer.sendSync('data:save', key, value),
  exportBackup: data => ipcRenderer.invoke('backup:export', data),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  loadBible: v => ipcRenderer.invoke('bible:load', v),
  loadXrefs: () => ipcRenderer.invoke('xrefs:load'),
});
