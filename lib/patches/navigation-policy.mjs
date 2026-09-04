import { runBestEffort } from './best-effort-events.mjs'

// [user-patch] External http(s) links are opened in the system browser instead
// of being dropped, so chat hyperlinks work. Re-applied by apply-link-fix.ps1
// after every DSH update (original policy denied all renderer popups and
// silently prevented external navigation).

export function classifyNavigation(target, runtimeOrigin) {
  let url
  try {
    url = new URL(target)
  } catch {
    return 'deny'
  }
  if (runtimeOrigin && url.origin === runtimeOrigin) return 'allow'
  if (url.protocol === 'https:' || url.protocol === 'http:') return 'external'
  return 'deny'
}

export function isOAuthPopupBootstrap(target) {
  return target === 'about:blank'
}

function closePopupSoon(browserWindow) {
  setImmediate(() => {
    if (!browserWindow.isDestroyed()) browserWindow.close()
  })
}

function installOAuthPopupPolicy({ browserWindow, openExternal, onError }) {
  const popupContents = browserWindow.webContents
  popupContents.on('will-navigate', (event, target) => {
    if (isOAuthPopupBootstrap(target)) return
    event.preventDefault()
    if (classifyNavigation(target) === 'external') runBestEffort(() => openExternal(target), onError)
    closePopupSoon(browserWindow)
  })
  popupContents.on('will-attach-webview', (event) => event.preventDefault())
  popupContents.setWindowOpenHandler(({ url }) => {
    if (classifyNavigation(url) === 'external') runBestEffort(() => openExternal(url), onError)
    return { action: 'deny' }
  })
}

export function installNavigationPolicy({ webContents, getRuntimeOrigin, openExternal, onError = () => {} }) {
  webContents.on('will-navigate', (event, target) => {
    const decision = classifyNavigation(target, getRuntimeOrigin())
    if (decision === 'allow') return
    event.preventDefault()
    // [user-patch] Hand external (http/https) top-frame navigation to the system browser.
    if (decision === 'external') runBestEffort(() => openExternal(target), onError)
  })
  webContents.on('will-attach-webview', (event) => event.preventDefault())
  webContents.setWindowOpenHandler(({ url }) => {
    if (isOAuthPopupBootstrap(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          show: false,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
          },
        },
      }
    }
    // [user-patch] Renderer-requested http(s) popups (chat markdown links,
    // search sources, etc.) are promoted to the system browser. All other
    // popups are still denied; OAuth uses the about:blank bootstrap above.
    if (classifyNavigation(url) === 'external') runBestEffort(() => openExternal(url), onError)
    return { action: 'deny' }
  })
  webContents.on('did-create-window', (browserWindow, details) => {
    if (!isOAuthPopupBootstrap(details.url)) {
      browserWindow.close()
      return
    }
    installOAuthPopupPolicy({ browserWindow, openExternal, onError })
  })
}