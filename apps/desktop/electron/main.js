/**
 * Electron main for the dsh desktop shell.
 *
 * The shell attaches to the loopback web server `dsh web` already serves:
 * the web-desktop plugin spawns it with `DSH_DESKTOP_URL` and
 * `DSH_DESKTOP_OWNER_PID` (the serving dsh process) in the environment. The
 * two processes own one lifetime: closing the window stops the owner, and a
 * 2-second owner watch closes the window when the launcher dies first
 * (Ctrl+C in the terminal).
 *
 * `DSH_DESKTOP_SMOKE_MS` turns the shell into a bounded smoke probe: it
 * opens the window, logs a ready line, and quits after that many
 * milliseconds without stopping the owner.
 */

import { spawnSync } from 'node:child_process'
import { app, BrowserWindow, dialog, shell } from 'electron'

/** The canonical loopback URL this shell renders; required. */
const url = process.env.DSH_DESKTOP_URL
/** The serving dsh process this shell stops when its window closes. */
const ownerPid = parsePositiveInt(process.env.DSH_DESKTOP_OWNER_PID)
/** When set, auto-quit after this many milliseconds without stopping the owner. */
const smokeMs = parsePositiveInt(process.env.DSH_DESKTOP_SMOKE_MS)

/** Attach timeout and poll interval for the server-readiness probe. */
const ATTACH_TIMEOUT_MS = 30_000
const ATTACH_POLL_MS = 250
/** How often the shell checks that its owner is still alive. */
const OWNER_WATCH_MS = 2_000

/**
 * Parse one environment value as a positive integer, or undefined.
 * @param value - the raw environment value.
 * @returns the integer, or undefined when the value is absent or non-numeric.
 */
function parsePositiveInt(value) {
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

if (url === undefined || url === '') {
  console.error('dsh-desktop: DSH_DESKTOP_URL is required')
  app.exit(2)
}

/** Whether the serving dsh process still exists (true when no owner was named). */
function ownerAlive() {
  if (ownerPid === undefined) return true
  try {
    process.kill(ownerPid, 0)
    return true
  } catch {
    return false
  }
}

/** Stop the serving dsh process; the shell is quitting with it. */
function stopOwner() {
  if (ownerPid === undefined) return
  if (process.platform === 'win32') {
    // No graceful SIGTERM exists on Windows: kill the whole launcher tree,
    // which includes this shell. /T is the point — closing the desktop
    // window ends the `dsh web --desktop` invocation.
    spawnSync('taskkill', ['/PID', String(ownerPid), '/T', '/F'], { windowsHide: true })
  } else {
    try {
      process.kill(ownerPid, 'SIGTERM')
    } catch {
      // The owner exited first; nothing to stop.
    }
  }
}

/** Poll the server until it answers, then fail the shell with a visible error. */
async function waitForServer() {
  const deadline = Date.now() + ATTACH_TIMEOUT_MS
  for (;;) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Not up yet; poll again.
    }
    if (Date.now() >= deadline) {
      dialog.showErrorBox(
        'DeepSeek Harness',
        `The web GUI did not answer at ${url} within ${String(ATTACH_TIMEOUT_MS / 1_000)}s.\n`
        + 'The launcher keeps serving in your terminal; quit it with Ctrl+C.',
      )
      app.exit(1)
      return
    }
    await new Promise(resolve => setTimeout(resolve, ATTACH_POLL_MS))
  }
}

/** Open the single shell window over the served GUI. */
async function openWindow() {
  await waitForServer()
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 560,
    title: 'DeepSeek Harness',
    backgroundColor: '#0d1117',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  // The GUI never opens child windows: links out to the default browser.
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('https:') || target.startsWith('http:')) {
      void shell.openExternal(target)
    }
    return { action: 'deny' }
  })
  console.log(`dsh-desktop: attaching to ${url}`)
  await window.loadURL(url)
  if (smokeMs !== undefined) {
    console.log(`dsh-desktop: ready ${url}`)
    setTimeout(() => app.quit(), smokeMs)
  }
}

// The owner died first (Ctrl+C in the launcher terminal): close the window.
const ownerWatch = setInterval(() => {
  if (!ownerAlive()) app.quit()
}, OWNER_WATCH_MS)
app.on('quit', () => clearInterval(ownerWatch))

// One window, one lifetime: closing it ends the launcher on every platform.
app.on('window-all-closed', () => app.quit())

// The window closes the launcher; smoke probes leave the owner alone.
app.on('will-quit', () => {
  if (smokeMs === undefined) stopOwner()
})

void app.whenReady().then(openWindow)
