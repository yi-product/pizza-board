const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require("electron");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(1); // packaged: [exe, ...flags]; dev: [., ...flags]
const WINDOWED = args.includes("--windowed");
const HARD_KIOSK = args.includes("--kiosk");
const FULLSCREEN = !WINDOWED;

/** 数据目录：默认跟 exe 同级的 data/，不写 C 盘 AppData */
function resolveUserDataDir() {
  const dataArg = args.find((a) => a.startsWith("--data-dir="));
  if (dataArg) return path.resolve(dataArg.slice("--data-dir=".length));
  if (process.env.PIZZA_BOARD_DATA) return path.resolve(process.env.PIZZA_BOARD_DATA);
  if (app.isPackaged) return path.join(path.dirname(process.execPath), "data");
  return path.join(__dirname, "data");
}

const userDataDir = resolveUserDataDir();
try {
  fs.mkdirSync(userDataDir, { recursive: true });
} catch (err) {
  console.error("无法创建数据目录:", userDataDir, err);
}
app.setPath("userData", userDataDir);

const PROTO_FILES = {
  baseline: "prototype.html",
  gallery: "prototype-v2-gallery.html",
  receipt: "prototype-v3-grid-receipt.html",
  grid: "prototype-v3-grid.html",
};

function resolveProto(filename) {
  const candidates = [
    path.join(process.resourcesPath, "protos", filename),
    path.join(__dirname, "protos", filename),
    path.join(__dirname, "..", filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("找不到原型文件: " + filename);
}

const KIOSK_CSS = fs.readFileSync(path.join(__dirname, "kiosk.css"), "utf8");
const KIOSK_JS = fs.readFileSync(path.join(__dirname, "kiosk-inject.js"), "utf8");

/* ==== 打印 ====
   配置跟数据一起放 exe 同级目录，店员选一次打印机就固化下来，不写注册表也不写 C 盘。 */
const PRINT_CONFIG_FILE = path.join(userDataDir, "print-config.json");
const printConfig = {
  enabled: true, // 总开关：打印机坏了/没纸，店员一键停掉所有打印
  autoPrint: true, // 保存后是否自动出纸；关掉后仍可手动打
  printer: "", // 空 = 用系统默认打印机
  copies: 1,
  brand: "YOUR STORE NAME",
};

function loadPrintConfig() {
  try {
    Object.assign(printConfig, JSON.parse(fs.readFileSync(PRINT_CONFIG_FILE, "utf8")));
  } catch (_) {
    /* 首次运行没有配置文件，用默认值 */
  }
}
function savePrintConfig() {
  try {
    fs.writeFileSync(PRINT_CONFIG_FILE, JSON.stringify(printConfig, null, 2), "utf8");
  } catch (err) {
    console.error("无法写入打印配置:", err);
  }
}
loadPrintConfig();

let mainWindow = null;
let currentPage = "launcher";

app.setName("披萨画板");
app.commandLine.appendSwitch("disable-pinch");
app.commandLine.appendSwitch("overscroll-history-navigation", "0");
app.commandLine.appendSwitch("touch-events", "enabled");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
// 大屏流畅度：强制 GPU 光栅化，减少合成卡顿
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("num-raster-threads", "4");
app.commandLine.appendSwitch("enable-features", "CanvasOopRasterization");

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  mainWindow = new BrowserWindow({
    width: WINDOWED ? Math.min(1600, width) : width,
    height: WINDOWED ? Math.min(900, height) : height,
    fullscreen: FULLSCREEN,
    kiosk: HARD_KIOSK,
    frame: WINDOWED,
    autoHideMenuBar: true,
    backgroundColor: "#2E4DB5",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      zoomFactor: 1,
      backgroundThrottling: false,
      v8CacheOptions: "code",
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);

  mainWindow.webContents.on("did-finish-load", async () => {
    try {
      await mainWindow.webContents.insertCSS(KIOSK_CSS);
      await mainWindow.webContents.executeJavaScript(KIOSK_JS);
    } catch (err) {
      console.error("kiosk inject failed:", err);
    }
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (!HARD_KIOSK && !FULLSCREEN) return;
    const key = (input.key || "").toLowerCase();
    const block =
      key === "f11" ||
      key === "f5" ||
      (input.alt && key === "f4") ||
      (input.meta && ["d", "r", "w"].includes(key));
    if (block) event.preventDefault();
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  loadLauncher();
}

function loadLauncher() {
  currentPage = "launcher";
  mainWindow.loadFile(path.join(__dirname, "launcher.html"));
}

function loadProto(id) {
  const [name, hash] = String(id).split("#");
  const filename = PROTO_FILES[name];
  if (!filename) return;
  currentPage = name;
  const file = resolveProto(filename);
  mainWindow.loadFile(file, hash ? { hash } : undefined);
}

ipcMain.on("open-proto", (_e, id) => {
  if (mainWindow) loadProto(id);
});
ipcMain.on("go-home", () => {
  if (mainWindow) loadLauncher();
});
ipcMain.on("quit-app", () => app.quit());

/* 打印任务串行执行：顾客连着保存时不会同时开出好几个隐藏窗口 */
let printQueue = Promise.resolve();

async function runPrintJob(payload) {
  if (!printConfig.enabled) return { ok: false, reason: "disabled" };
  let win = null;
  try {
    // 不能直接打主窗口——那会把整面披萨墙印出来。单开一个不显示的窗口装打印排版。
    win = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    await win.loadFile(path.join(__dirname, "print.html"));
    const data = Object.assign({ brand: printConfig.brand }, payload);
    await win.webContents.executeJavaScript(`renderTicket(${JSON.stringify(data)})`);

    return await new Promise((resolve) => {
      // 打印机离线时回调可能一直不来，兜一个超时，绝不能让队列卡死
      const timer = setTimeout(() => resolve({ ok: false, reason: "timeout" }), 30000);
      win.webContents.print(
        {
          silent: true, // kiosk 下绝不能弹系统打印对话框
          printBackground: true,
          color: true,
          copies: Math.max(1, printConfig.copies || 1),
          pageSize: "A4",
          landscape: false,
          margins: { marginType: "none" },
          deviceName: printConfig.printer || undefined,
        },
        (ok, reason) => {
          clearTimeout(timer);
          resolve({ ok, reason });
        }
      );
    });
  } catch (err) {
    return { ok: false, reason: String((err && err.message) || err) };
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
}

ipcMain.handle("print-pizza", (_e, payload) => {
  printQueue = printQueue
    .catch(() => {})
    .then(() => runPrintJob(payload))
    .catch((err) => ({ ok: false, reason: String((err && err.message) || err) }));
  return printQueue;
});

ipcMain.handle("list-printers", async () => {
  if (!mainWindow) return [];
  try {
    const list = await mainWindow.webContents.getPrintersAsync();
    return list.map((p) => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault }));
  } catch (err) {
    console.error("列出打印机失败:", err);
    return [];
  }
});

ipcMain.handle("get-print-config", () => ({ ...printConfig }));
ipcMain.handle("set-print-config", (_e, patch) => {
  if (patch && typeof patch === "object") {
    if (typeof patch.enabled === "boolean") printConfig.enabled = patch.enabled;
    if (typeof patch.autoPrint === "boolean") printConfig.autoPrint = patch.autoPrint;
    if (typeof patch.printer === "string") printConfig.printer = patch.printer;
    if (typeof patch.brand === "string") printConfig.brand = patch.brand;
    if (Number.isFinite(patch.copies)) printConfig.copies = Math.min(5, Math.max(1, patch.copies));
    savePrintConfig();
  }
  return { ...printConfig };
});
ipcMain.handle("get-mode", () => ({
  windowed: WINDOWED,
  fullscreen: FULLSCREEN,
  kiosk: HARD_KIOSK,
  page: currentPage,
  packaged: app.isPackaged,
  userDataDir,
}));

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register("CommandOrControl+Shift+Q", () => app.quit());
  globalShortcut.register("CommandOrControl+Shift+L", () => {
    if (mainWindow) loadLauncher();
  });
  globalShortcut.register("CommandOrControl+Shift+W", () => {
    if (!mainWindow) return;
    if (mainWindow.isKiosk()) mainWindow.setKiosk(false);
    if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
  });

  app.on("activate", () => {
    if (!mainWindow) createWindow();
  });
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => globalShortcut.unregisterAll());
