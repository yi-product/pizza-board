const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pizzaApp", {
  openProto: (id) => ipcRenderer.send("open-proto", id),
  goHome: () => ipcRenderer.send("go-home"),
  quit: () => ipcRenderer.send("quit-app"),
  mode: () => ipcRenderer.invoke("get-mode"),
  printPizza: (payload) => ipcRenderer.invoke("print-pizza", payload),
  listPrinters: () => ipcRenderer.invoke("list-printers"),
  getPrintConfig: () => ipcRenderer.invoke("get-print-config"),
  setPrintConfig: (patch) => ipcRenderer.invoke("set-print-config", patch),
});
