// Latif Kids desktop app: the live platform in its own window (Windows / Mac).
const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('node:path');

const HOME = 'https://latif-kids.vercel.app/ar/login';
const ALLOWED = ['latif-kids.vercel.app', 'latif-kids-api.vercel.app', 'accounts.google.com'];
const OFFLINE = path.join(__dirname, 'offline.html');

const sameApp = (url) => {
  try {
    return ALLOWED.includes(new URL(url).hostname);
  } catch {
    return false;
  }
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    title: 'Latif Kids',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#f2f4f5',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false },
  });

  win.loadURL(HOME);

  // No internet / server unreachable → friendly page with a retry button.
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && !url.startsWith('file:')) win.loadFile(OFFLINE, { query: { back: url || HOME } });
  });

  // Links to other sites open in the normal browser; the platform stays in the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (sameApp(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!sameApp(url) && !url.startsWith('file:')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
}

const t = (ar, en) => (app.getLocale().startsWith('ar') ? ar : en);

app.whenReady().then(() => {
  // Camera (QR scan) and notifications only for the platform itself.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(['media', 'notifications', 'clipboard-sanitized-write', 'fullscreen'].includes(permission) && sameApp(wc.getURL()));
  });

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: t('عرض', 'View'), submenu: [
        { label: t('الصفحة الرئيسية', 'Home'), accelerator: 'CmdOrCtrl+H', click: (_m, w) => w && w.loadURL(HOME) },
        { role: 'reload', label: t('تحديث', 'Reload') },
        { type: 'separator' },
        { role: 'zoomIn', label: t('تكبير', 'Zoom in') },
        { role: 'zoomOut', label: t('تصغير', 'Zoom out') },
        { role: 'resetZoom', label: t('الحجم الأصلي', 'Actual size') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('ملء الشاشة', 'Full screen') },
      ] },
      { role: 'editMenu', label: t('تحرير', 'Edit') },
      { role: 'windowMenu', label: t('نافذة', 'Window') },
    ]),
  );

  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

// One window: opening the app again focuses it.
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  const [w] = BrowserWindow.getAllWindows();
  if (w) {
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
