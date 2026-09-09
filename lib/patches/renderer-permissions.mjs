// [user-patch] Also allow clipboard-read (loopback only), so pasting externally
// copied text works in the renderer.

const ALLOWED_CLIPBOARD_PERMISSIONS = new Set(['clipboard-sanitized-write', 'clipboard-read'])
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

function safeOrigin(value) {
  try {
    const url = new URL(value)
    return LOOPBACK_HOSTS.has(url.hostname) ? url.origin : undefined
  } catch {
    return undefined
  }
}

export function isAllowedRendererPermission({ permission, requestingUrl, activeOrigin }) {
  if (!ALLOWED_CLIPBOARD_PERMISSIONS.has(permission)) return false
  const expected = safeOrigin(activeOrigin)
  const requested = safeOrigin(requestingUrl)
  return expected !== undefined && requested === expected
}

export function installRendererPermissions({ session, getActiveOrigin }) {
  session.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => (
    isAllowedRendererPermission({
      permission,
      requestingUrl: requestingOrigin,
      activeOrigin: getActiveOrigin(),
    })
  ))
  session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(isAllowedRendererPermission({
      permission,
      requestingUrl: details?.requestingUrl || webContents?.getURL?.(),
      activeOrigin: getActiveOrigin(),
    }))
  })
}
