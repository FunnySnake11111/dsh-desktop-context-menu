// [user-patch] Allow clipboard-read (loopback only), so the renderer can
// read the system clipboard for paste / clipboard sync. Original policy only
// allowed clipboard-sanitized-write; this keeps the exact same security
// boundary (loopback origins only) and adds read access alongside it.
// Re-applied by the host-patch self-heal after every DSH update.
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
