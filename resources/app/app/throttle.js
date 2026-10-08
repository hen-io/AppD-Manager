"use strict";
const { app, BrowserWindow, WebContentsView, session } = require("electron");
const coverWindow = require("./overlay");
module.exports = function createThrottle(cfg, { note, because }) {
  let stoppedPids = [];
  function pagePids() {
    const pids = /* @__PURE__ */ new Set();
    for (const window of BrowserWindow.getAllWindows()) {
      for (const frame of window.webContents.mainFrame.framesInSubtree) pids.add(frame.osProcessId);
    }
    return [...pids].filter((pid) => pid > 0);
  }
  function signalAll(pids, signal) {
    for (const pid of pids) {
      try {
        process.kill(pid, signal);
      } catch {
      }
    }
  }
  function pausePage() {
    if (stoppedPids.length) return;
    stopLimiter();
    stoppedPids = pagePids();
    signalAll(stoppedPids, "SIGSTOP");
  }
  function resumePage() {
    signalAll(stoppedPids, "SIGCONT");
    stoppedPids = [];
    runLimiter();
  }
  const LIMIT_PERIOD_MS = 100;
  const LIMIT_MIN_RUN_MS = 2;
  const percent = (value) => value > 0 && value < 100 ? value : 100;
  const alwaysPercent = percent(cfg.cpuPercent);
  const awayPercent = cfg.backgroundThrottling ? Math.min(alwaysPercent, percent(cfg.unfocusedCpuPercent)) : alwaysPercent;
  let cpuPercentNow = alwaysPercent;
  let limiterTimer = null;
  let limitedPids = [];
  let quitting = false;
  function stopLimiter() {
    clearTimeout(limiterTimer);
    limiterTimer = null;
    signalAll(limitedPids, "SIGCONT");
    limitedPids = [];
  }
  function runLimiter() {
    stopLimiter();
    if (quitting || cpuPercentNow >= 100 || stoppedPids.length) return;
    const runMs = Math.max(LIMIT_MIN_RUN_MS, LIMIT_PERIOD_MS * cpuPercentNow / 100);
    const periodMs = Math.max(LIMIT_PERIOD_MS, runMs * 100 / cpuPercentNow);
    const slice = () => {
      signalAll(limitedPids, "SIGCONT");
      limitedPids = pagePids();
      limiterTimer = setTimeout(() => {
        signalAll(limitedPids, "SIGSTOP");
        limiterTimer = setTimeout(slice, periodMs - runMs);
      }, runMs);
    };
    slice();
  }
  function setCpuPercent(value) {
    if (value === cpuPercentNow) return;
    cpuPercentNow = value;
    runLimiter();
  }
  function releasePage() {
    quitting = true;
    stopLimiter();
    signalAll(stoppedPids, "SIGCONT");
    stoppedPids = [];
  }
  app.on("before-quit", releasePage);
  process.on("exit", releasePage);
  function watchFocus(window) {
    const wc = window.webContents;
    const GRACE_MS = 3e3;
    let timer = null;
    let pauseTimer = null;
    let slowTimer = null;
    let watchdog = null;
    let idleSince = 0;
    let throttled = false;
    let soundCheck = null;
    let cover = null;
    let round = 0;
    let gone = false;
    let hovered = false;
    let hoverTimer = null;
    const inUse = () => hovered || Boolean(BrowserWindow.getFocusedWindow());
    const SETTLE_MS = 1e4;
    const LOAD_MAX_MS = 6e4;
    let busyUntil = Date.now() + LOAD_MAX_MS;
    const busy = () => Date.now() < busyUntil;
    wc.on("did-start-navigation", (details) => {
      if (!details.isMainFrame || details.isSameDocument) return;
      busyUntil = Date.now() + LOAD_MAX_MS;
      if (throttled) setCpuPercent(alwaysPercent);
    });
    wc.on("did-stop-loading", () => {
      busyUntil = Date.now() + SETTLE_MS;
    });
    const COVER_STEP_MS = 1500;
    const withinMoment = (promise) => Promise.race([
      promise.catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), COVER_STEP_MS))
    ]);
    const showPicture = async (view, picture, width) => {
      const page = '<body style="margin:0;overflow:hidden"><img id="picture" style="display:block">';
      await view.webContents.loadURL(`data:text/html,${encodeURIComponent(page)}`);
      await view.webContents.executeJavaScript(
        `picture.style.width = '${width}px'; picture.src = ${JSON.stringify(picture.toDataURL())}; picture.decode()`
      );
    };
    const dropCover = (view) => {
      try {
        view.stopCovering?.();
        if (!window.isDestroyed()) window.contentView.removeChildView(view);
        view.webContents.close();
      } catch {
      }
    };
    const pause = async () => {
      if (wc.isDevToolsOpened()) return;
      if (busy()) {
        pauseTimer = setTimeout(pause, Math.max(1e3, busyUntil - Date.now()));
        return;
      }
      clearTimeout(slowTimer);
      const mine = ++round;
      const overtaken = () => mine !== round || window.isDestroyed();
      stopLimiter();
      const picture = await withinMoment(wc.capturePage());
      if (overtaken()) return;
      if (picture && !picture.isEmpty()) {
        const [width, height] = window.getContentSize();
        const view = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
        view.setBackgroundColor("#00000000");
        view.setBounds({ x: 0, y: 0, width, height });
        cover = view;
        watchMouse(view.webContents);
        window.contentView.addChildView(view);
        view.stopCovering = coverWindow(window, view);
        await withinMoment(showPicture(view, picture, width));
        if (overtaken()) return;
      }
      pausePage();
      note("paused (pauseWhenUnfocused)");
      if (cfg.skipMissedUpdates) dropBacklog();
      watchdog = setInterval(() => {
        if (window.isDestroyed()) clearInterval(watchdog);
        else if (inUse()) back();
      }, 1e3);
    };
    const away = () => {
      gone = true;
      idleSince = Date.now() - GRACE_MS;
      if (awayPercent < alwaysPercent) {
        slowTimer = setTimeout(() => {
          throttled = true;
          const apply = () => setCpuPercent(wc.isCurrentlyAudible() || busy() ? alwaysPercent : awayPercent);
          apply();
          soundCheck = setInterval(apply, 3e3);
        }, Math.max(0, cfg.slowAfterSeconds * 1e3 - GRACE_MS));
      }
      if (cfg.pauseWhenUnfocused) {
        pauseTimer = setTimeout(pause, Math.max(0, cfg.pauseAfterSeconds * 1e3 - GRACE_MS));
      }
    };
    const dropBacklog = () => session.defaultSession.closeAllConnections().catch(() => {
    });
    const SKIP_AFTER_MS = 3e4;
    const back = async () => {
      gone = false;
      clearTimeout(timer);
      clearTimeout(pauseTimer);
      clearTimeout(slowTimer);
      clearInterval(watchdog);
      watchdog = null;
      const mine = ++round;
      clearInterval(soundCheck);
      const awayMs = idleSince ? Date.now() - idleSince : 0;
      if (cfg.skipMissedUpdates && awayMs >= SKIP_AFTER_MS && (stoppedPids.length || throttled)) {
        note(`back after ${Math.round(awayMs / 1e3)} s: connections closed so the app reconnects (skipMissedUpdates)`);
        await dropBacklog();
        if (mine !== round || window.isDestroyed()) return;
      }
      resumePage();
      if (throttled) {
        throttled = false;
        setCpuPercent(alwaysPercent);
      }
      const idleMs = idleSince ? Date.now() - idleSince : 0;
      idleSince = 0;
      const reloading = cfg.reloadAfterIdleMinutes > 0 && idleMs >= cfg.reloadAfterIdleMinutes * 6e4 && !window.isDestroyed();
      if (cover) {
        const view = cover;
        cover = null;
        let dropped = false;
        const drop = () => {
          if (dropped) return;
          dropped = true;
          dropCover(view);
        };
        if (reloading) wc.once("did-finish-load", drop);
        setTimeout(drop, reloading ? 1e4 : 300);
      }
      if (reloading) because(`back after ${Math.round(idleMs / 6e4)} minutes away (reloadAfterIdleMinutes)`) || wc.reloadIgnoringCache();
    };
    const leave = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!window.isDestroyed() && !inUse()) away();
      }, GRACE_MS);
    };
    const DWELL_MS = 250;
    const enter = () => {
      clearTimeout(hoverTimer);
      hoverTimer = null;
      hovered = true;
      clearTimeout(timer);
      if (gone) back();
    };
    const exit = () => {
      clearTimeout(hoverTimer);
      hoverTimer = null;
      if (!hovered) return;
      hovered = false;
      if (!BrowserWindow.getFocusedWindow()) leave();
    };
    function watchMouse(contents) {
      contents.on("input-event", (_event, input) => {
        if (input.type === "mouseLeave") return exit();
        if (hovered || !input.type.startsWith("mouse")) return;
        if (input.type === "mouseWheel" || input.type === "mouseDown") enter();
        else hoverTimer ??= setTimeout(enter, DWELL_MS);
      });
    }
    watchMouse(wc);
    window.on("hide", exit);
    window.on("minimize", exit);
    window.on("blur", () => {
      if (!hovered) leave();
    });
    window.on("focus", back);
    window.on("restore", back);
    window.on("close", resumePage);
    window.on("closed", () => {
      clearTimeout(timer);
      clearTimeout(hoverTimer);
      clearTimeout(pauseTimer);
      clearInterval(watchdog);
      clearInterval(soundCheck);
    });
  }
  return {
    watchFocus,
    runLimiter,
    resumePage,
    releasePage,
    isQuitting: () => quitting,
    wanted: cfg.pauseWhenUnfocused || cfg.reloadAfterIdleMinutes > 0 || awayPercent < alwaysPercent
  };
};
