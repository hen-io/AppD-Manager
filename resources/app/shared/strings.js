"use strict";
module.exports = {
  sections: {
    general: "General",
    window: "Window",
    tabs: "Tabs",
    tray: "Tray window",
    links: "Links",
    extensions: "Extensions",
    performance: "Performance",
    slow: "Slow down when not in use",
    pause: "Pause when not in use",
    advanced: "Advanced"
  },
  settings: {
    type: { label: "Kind of app" },
    name: { label: "Name", placeholder: "App name..." },
    url: { label: "URL", placeholder: "url..." },
    description: { label: "Description", placeholder: "Shown under the name in the menu" },
    autostart: { label: "Start this app when you log in" },
    closeToTray: { label: "Keep running in the system tray when the window is closed" },
    startHidden: { label: "Start hidden in the tray" },
    unreadBadge: { label: "Show the site's unread count on the app's icon in the taskbar" },
    width: { label: "Width" },
    height: { label: "Height" },
    startMaximized: { label: "Always open maximized" },
    startFullScreen: { label: "Open in full screen" },
    colorScheme: {
      label: "Light or dark mode",
      note: "Only affects sites that support both. For sites without a dark mode, add the Dark Reader extension.",
      options: { system: "Follow the system", light: "Light", dark: "Dark" }
    },
    actionButton: {
      label: "Menu button",
      note: "A small round button in a corner of the window that opens the app's menu (reload, mute, zoom, full screen, extensions). The same menu always opens with a right-click on the page.",
      options: {
        off: ["Hidden", "Open the menu by right-clicking the page"],
        "top-left": "Top left",
        "top-right": "Top right",
        "bottom-left": "Bottom left",
        "bottom-right": "Bottom right"
      }
    },
    alwaysOnTop: { label: "Keep the window above all others" },
    startMuted: { label: "Start with the sound off", note: `Turn sound on or off any time with "Mute sound" in the app's menu.` },
    windowDecorations: {
      label: "Show window decorations (title bar and borders)",
      note: "Without a title bar: move the window with Meta+drag, and minimize, maximize or close it from the app's menu (right-click the page) or with Alt+F4."
    },
    windowRadius: { label: "Corner radius" },
    windowBorderWidth: { label: "Border width" },
    windowBorderStyle: {
      label: "Border style",
      options: {
        solid: ["Solid", "A plain line"],
        double: ["Double", "Two thin lines; needs a width of 3 or more"],
        dashed: ["Dashed", "Short dashes"],
        dotted: ["Dotted", "Dots"],
        groove: ["Groove", "Looks carved in; best at width 4 or more"],
        ridge: ["Ridge", "Looks raised; best at width 4 or more"]
      }
    },
    windowGlow: { label: "Glow size" },
    windowGlowSide: {
      label: "Glow position",
      note: "A glow works with or without a border. An outside glow needs a compositing desktop (KDE has one).",
      options: {
        inner: ["Inside", "Fades inwards, over the page"],
        outer: ["Outside", "Fades outwards, around the window"],
        both: ["Both", "Inside and outside"]
      }
    },
    windowBorderOpacity: { label: "Colour opacity" },
    fixedTitle: { label: "Always show the app name as window title" },
    loadingScreen: { label: "Show a loading screen with the app's icon at start" },
    defaultZoom: { label: "Default zoom" },
    allowZoom: {
      label: "Allow zooming (Ctrl +, Ctrl -, Ctrl + mouse wheel)",
      note: `Your zoom lasts until the page reloads or the app restarts. "Reset zoom" in the app's menu (Ctrl+0) returns to the default.`
    },
    hideScrollbars: { label: "Hide scrollbars (pages still scroll)" },
    tabBarPosition: {
      label: "Tab bar",
      options: { top: ["Top", "Above the page"], bottom: "Bottom", left: ["Left", "A column beside the page: room for long names"] }
    },
    tabInactive: {
      label: "Tabs you are not looking at",
      note: "What happens to a tab after you have left it. A tab that plays sound or is loading is left alone.",
      options: {
        keep: ["Keep running", "Nothing changes: chat and mail tabs keep up to date"],
        throttle: ["Slow down", "The browser lets the page run about once a second: little saved, nothing lost"],
        pause: ["Pause", "The page is stopped outright and goes on when you come back: saves the most CPU, but it misses what happens meanwhile"],
        unload: ["Unload", "The page is closed and loaded anew when you come back: frees the most memory, unsaved input is lost"]
      }
    },
    tabInactiveAfterSeconds: { label: "After" },
    tabLazyLoad: { label: "Load a tab when it is first opened", note: "Off: every tab loads when the app starts." },
    tabRememberLast: { label: "Start on the tab you left" },
    tabShowIcons: { label: "Show the sites' pictures in the tabs" },
    tabShowBadges: { label: "Show unread counts in the tabs", note: 'The number a site puts in its title, "(3) Inbox".' },
    trayWidth: { label: "Window width" },
    trayHeight: { label: "Window height" },
    trayPosition: {
      label: "Window position",
      options: {
        "bottom-right": ["Bottom right", "Where the tray usually is"],
        "bottom-center": "Bottom centre",
        "bottom-left": "Bottom left",
        "top-right": "Top right",
        "top-center": "Top centre",
        "top-left": "Top left",
        custom: ["Custom", 'Set with "Place on screen"']
      }
    },
    trayScreen: {
      label: "Screen",
      any: ["Screen with the mouse pointer", "May pick the wrong screen on Wayland"],
      screen: "Screen {number}",
      main: ", the main screen",
      note: "Screens are numbered from left to right. Pick the one your tray is on if the window opens on the wrong screen."
    },
    trayMargin: {
      label: "Margin from screen edges",
      note: "The gap between the window and the edge of the usable screen area (panels and taskbars are outside that area)."
    },
    trayAtIcon: {
      label: "Open next to the tray icon when possible",
      note: "Works on X11 when the tray is in a panel. On Wayland an app cannot see where its icon is: choose a screen and position above, or place the window yourself."
    },
    trayHideOnBlur: { label: "Hide the window when you click elsewhere" },
    trayShowAtStart: {
      label: "Show the window when the app starts",
      note: "Off: the app starts hidden in the tray. Corner radius, border and glow are under Window."
    },
    trayHotkey: {
      label: "Shortcut to show or hide the window",
      placeholder: "Click here, then press the shortcut",
      note: `Ctrl, Alt, Shift or Super plus a key, for example Super+Alt+Y. Works from anywhere if your desktop allows it; on Wayland it may ask you first. If it does nothing, assign a shortcut to this app's "Show or hide the window" action in your desktop's shortcut settings (KDE: System Settings, Keyboard, Shortcuts).`
    },
    trayOpenAt: {
      label: "When reopened, show",
      options: {
        last: ["The last page", "Where you left off"],
        home: ["The app's start page", "The URL under General"]
      }
    },
    trayCloseAfterSeconds: {
      label: "Unload the page when hidden for",
      note: "0 = never. Frees memory while you are not using the app: the tray icon stays, and the page loads again when you open the window. Never happens while sound is playing."
    },
    openLinks: {
      label: "Links that open a new window",
      options: { browser: "Open in the default browser", window: "Open in a new window of this app", same: "Open in the same window" }
    },
    internalHosts: {
      label: "Sites that open inside the app",
      placeholder: "accounts.google.com",
      note: `One host per line, such as accounts.google.com. Used with "default browser": links to these sites, and to the app's own site, open in an app window instead (sign-in pop-ups need this).`
    },
    linksToApps: {
      label: "Open links to your other apps' sites in those apps",
      note: "A link to a site you have an app for opens in that app (starting it if needed) instead of the browser."
    },
    homeButton: { label: 'Show a "Back to app" button on other sites' },
    hardwareAcceleration: {
      label: "Hardware acceleration",
      note: "Uses the graphics card for drawing and video wherever possible. Switch it off if the app shows glitches or an empty window."
    },
    cpuPercent: {
      label: "CPU limit",
      note: "Limits how much CPU the page may use, even while you are using the app (it will feel slower). 100 = no limit."
    },
    keepAwake: {
      label: "Keep the computer awake while the app is open",
      options: {
        off: ["No", "The computer sleeps as usual"],
        display: ["Yes, and keep the screen on", "For dashboards and wall displays"],
        system: ["Yes, but let the screen turn off", "For music players and downloads"]
      }
    },
    reloadEverySeconds: {
      label: "Reload the page every",
      note: "0 = never. For dashboards that do not refresh themselves. Skipped while the page is paused or has unsaved changes."
    },
    jsHeapMb: { label: "JavaScript memory limit", note: "0 = default. Raise it for very heavy apps." },
    backgroundThrottling: {
      label: "Slow the page down when you are not using the window (saves CPU)",
      note: "A window counts as in use while it has focus or the mouse is over it."
    },
    slowAfterSeconds: { label: "Start slowing down after" },
    unfocusedCpuPercent: {
      label: "CPU limit while slowed down",
      note: "How much CPU the page may use while slowed down. The app keeps running, just slower. Not applied while sound is playing or a page is loading. If the CPU limit under Performance is lower, that one is used."
    },
    pauseWhenUnfocused: {
      label: "Pause the page when you are not using the window",
      note: "A paused app does nothing at all until you return to it: no new messages, no notifications, no playback. It keeps showing what was on screen. Until the pause starts, the slow-down above applies."
    },
    pauseAfterSeconds: { label: "Pause after" },
    skipMissedUpdates: {
      label: "Reconnect when you return (skip missed updates)",
      note: "For apps that show live data. After being slowed down or paused for 30 seconds or more, the app reconnects and shows the current state instead of replaying everything it missed."
    },
    reloadAfterIdleSeconds: { label: "Reload when you return after more than", note: "0 = never. Counted from when you stopped using the window." },
    userAgent: {
      label: "User agent",
      placeholder: "Default: same as Chrome",
      note: "How the app identifies itself to sites, which use it to choose a phone, tablet or TV layout. Empty = desktop Chrome. Some layouts also need their own URL: YouTube's TV interface is youtube.com/tv with a TV user agent."
    },
    language: {
      label: "Language",
      placeholder: "en-GB",
      note: "Preferred language for sites, dates and spell-checking, as a code such as en-GB, nb or de. Empty = system language."
    },
    downloadFolder: {
      label: "Download folder",
      placeholder: "Ask each time",
      note: "Downloads are saved here without asking. Empty = ask every time.",
      ask: "Choose the folder this app's downloads go to"
    },
    proxy: {
      label: "Proxy",
      placeholder: "socks5://127.0.0.1:1080",
      note: "Route this app's traffic through a proxy (socks5://, socks4:// or http://). Empty = system setting. Other apps are not affected."
    },
    spellcheck: { label: "Check spelling in text fields" },
    spellcheckLanguages: {
      label: "Spell-check languages",
      placeholder: "en-US",
      note: "One per line, such as en-US, nb or de. Empty = system language. Right-click an underlined word for suggestions."
    },
    ignoreCertificateErrors: {
      label: "Ignore certificate errors (accept invalid, expired and self-signed certificates)",
      note: "Only for apps on your own network, such as a device with a self-signed certificate. When on, the app no longer verifies that any site is who it claims to be."
    },
    permissions: {
      label: "Site permissions (camera, microphone, location, notifications, screen sharing)",
      note: "There are no per-site prompts: allowed sites get what they ask for.",
      options: {
        app: ["Only the app's own site", "Plus the sites that open inside the app. Ads and embedded sites get nothing"],
        all: ["All sites", "Including embedded sites and other sites you visit in the app"],
        none: ["None", "No camera, microphone, location or notifications at all"]
      }
    },
    customCss: {
      label: "Custom CSS",
      placeholder: ".some-banner { display: none !important; }",
      note: "Your own CSS, added to every page of the app: hide something, change a font, widen a column."
    },
    customJs: {
      label: "Custom JavaScript",
      placeholder: "document.querySelector('.some-button')?.click();",
      note: "Your own script, run on every page of the app after it loads. It can do anything the site can, so only use code you understand."
    },
    flags: {
      label: "Extra Chromium flags",
      placeholder: "--some-switch=value",
      note: "One per line. Applied the next time the app starts."
    },
    adBlockInPageAds: {
      label: "Block ads served by the site itself (YouTube video ads)",
      note: "YouTube may delay a video for about as long as the removed ad would have played, so videos can take a few seconds to start."
    },
    adBlockHideLeftovers: { label: "Hide the empty space left by blocked ads" },
    adBlockAnnoyances: {
      label: "Block cookie banners and other pop-ups",
      note: 'Also blocks cookie notices, newsletter sign-up boxes and "allow notifications" prompts. If a site stops working because its banner was never answered, add it to the list below.'
    },
    adBlockExceptions: {
      label: "Sites to never block on",
      placeholder: "example.com",
      note: "One per line. For sites that break when the blocker is on."
    },
    sponsorBlockMarkers: { label: "Mark the segments on the seek bar" },
    sponsorBlockShowDuration: { label: "Show the video's length without the segments" },
    sponsorBlockNotes: { label: "Show a note, with a way back, when something was skipped" },
    sponsorBlockSummary: { label: "Show a note of what was found when a video opens" },
    sponsorBlockUpcomingNotice: { label: "Announce an automatic skip a few seconds ahead" },
    sponsorBlockSound: { label: "Play a short sound when something is skipped" },
    sponsorBlockMute: { label: "Also handle segments that are marked to be muted, not skipped" },
    sponsorBlockFullVideo: { label: "Label videos that as a whole are a sponsorship or self-promotion" },
    sponsorBlockAskOnFullVideo: { label: "In such a video, ask before skipping segments of that same kind" },
    sponsorBlockMusicAutoSkip: { label: "In music videos with non-music parts marked, skip without asking" },
    sponsorBlockMusicOnlyOnYoutubeMusic: { label: "Handle non-music parts on YouTube Music only" },
    sponsorBlockCountSkips: {
      label: "Tell the database which segments were skipped",
      note: "It counts how often a segment is skipped. Looking a video up never tells it which video you watch; this does."
    },
    sponsorBlockNoticeSeconds: { label: "Notes stay for" },
    sponsorBlockMinSeconds: { label: "Ignore segments shorter than" },
    sponsorBlockSkipKey: { label: "Key: skip / unskip", placeholder: "none" },
    sponsorBlockHighlightKey: { label: "Key: jump to highlight", placeholder: "none" },
    sponsorBlockCloseKey: { label: "Key: close the box", placeholder: "none" },
    sponsorBlockChannels: {
      label: "Channels where nothing is skipped",
      placeholder: "@handle or channel name",
      note: "One per line: a channel's name, @handle or id. Its segments are still marked."
    },
    sponsorBlockServer: { label: "Database server", placeholder: "https://sponsor.ajay.app" },
    youtubeQuality: {
      label: "YouTube video quality",
      note: "Every video starts in this quality; one that does not have it gets the next lower one it has. You can still change it in the player.",
      options: {
        auto: "Automatic (YouTube decides)",
        "4320p": "4320p (8K)",
        "2160p": "2160p (4K)",
        "1440p": "1440p",
        "1080p": "1080p",
        "720p": "720p",
        "480p": "480p",
        "360p": "360p",
        "240p": "240p",
        "144p": "144p"
      }
    },
    darkBrightness: { label: "Brightness" },
    darkContrast: { label: "Contrast" },
    darkSepia: { label: "Sepia" }
  },
  notes: {
    windowNote: "The size on first start. After that the window opens the way you left it, unless it always opens maximized.",
    windowNote2: "These apply to windows without a title bar (and to tray apps). Rounded corners need a compositing desktop (KDE has one); maximized and full-screen windows stay square.",
    tabsNote: "The first tab is the app's own address. Tabs share logins and cookies, as the tabs of one browser do. Ctrl+Tab and Ctrl+1 to 9 switch between them.",
    trayNote: "The app sits in the system tray. Click its icon to open a small window without a title bar; right-click the icon for its menu. It is not in the desktop's menu or the taskbar.",
    sponsorblockNote: 'What happens when a video reaches a part of that kind, and its colour on the seek bar. "Ask" shows a box with a Skip button for as long as the part plays.',
    sponsorblockNote2: "Written like Enter, Backspace, K or Ctrl+Shift+K. The skip key acts on the box that is showing."
  },
  prefs: {
    confirmRemove: { label: "Ask before removing an app", note: 'A removed app can always be restored for a few seconds with "Undo".' },
    restartOnSave: {
      label: "After saving an app that is running",
      options: {
        ask: ["Ask whether to restart it", "A question each time: restart now, or later"],
        always: ["Restart it at once", "It comes back on the page it was on; what was typed into the page is lost"],
        never: ["Leave it running", "The new settings apply the next time it starts"]
      }
    },
    showUsage: { label: "Show CPU and memory use of running apps" },
    appOrder: { label: "Order of the apps in the sidebar" },
    motion: { label: "Animations", note: "Off: views, menus and sliders switch instantly instead of animating." },
    checkUpdates: { label: "Look for a new version every time AppD-Manager starts" },
    restartAppsOnUpdate: {
      label: "Restart running apps when AppD-Manager is updated",
      note: "Each app comes back on the page it was on, running the new version. Off: an app keeps the old version until you close it."
    },
    updateChannel: {
      label: "Release branch",
      options: {
        main: ["Stable", "Main releases"],
        beta: ["BETA", "BETA releases might contain bugs, remember to keep backups of your configuration!"]
      }
    },
    backupBeforeUpdate: {
      label: "Back up before installing updates or downgrading AppD-Manager",
      note: "The program as it is, every app's settings and icon, and the manager's settings, in a folder named after the date, time and version."
    },
    backupsKept: { label: "Backups to keep", note: "Older backups are deleted when a new one is made, and whenever AppD-Manager starts." }
  },
  appOrders: {
    usage: ["Resource use", "Running apps first, the one using the most on top"],
    name: "Name",
    used: ["Last used", "The app you used last comes first"],
    running: ["Running first", "Then by name"]
  },
  sponsorActions: { off: "Off", show: "Show on the seek bar only", ask: "Ask before skipping", skip: "Skip automatically" },
  sponsorActionsFor: {
    poi_highlight: { ask: "Offer a jump to it", skip: "Jump to it at the start" },
    exclusive_access: { show: "Show a label" }
  },
  agentPresets: [
    ["Default", "Desktop Chrome"],
    ["Mobile phone", "Android, Chrome"],
    ["Mobile phone", "iPhone, Safari"],
    ["Tablet", "Android, Chrome"],
    ["Tablet", "iPad, Safari"],
    ["TV", "Android TV / Google TV"],
    ["TV", "Samsung, Tizen"],
    ["TV", "LG, webOS"],
    ["Game console", "PlayStation 5"],
    ["Desktop", "Chrome on Windows"],
    ["Desktop", "Chrome on macOS"],
    ["Desktop", "Edge on Windows"],
    ["Desktop", "Safari on macOS"],
    ["Desktop", "Firefox on Linux"]
  ],
  flagPresets: {
    "--enable-features=WebContentsForceDark": "Dark mode for sites that have none",
    "--autoplay-policy=no-user-gesture-required": "Lets sound and video start by themselves",
    "--enable-features=TouchpadOverscrollHistoryNavigation": "Two-finger swipe for back and forward",
    "--disable-smooth-scrolling": "No smooth scrolling",
    "--enable-wayland-ime": "Input methods (IME) on Wayland",
    "--lang=en-US": "Language of the app and of sites. Edit the code after adding it",
    "--proxy-server=socks5://127.0.0.1:1080": "Go through a proxy. Edit the address after adding it",
    "--disk-cache-size=104857600": "Limit of the disk cache, in bytes. Edit the number after adding it",
    "--disable-background-timer-throttling": "Keep timers at full speed in the background",
    "--disable-renderer-backgrounding": "Keep full priority in the background",
    "--process-per-site": "One process per site instead of one per tab or frame: less memory for apps that open many windows",
    "--enable-features=SkiaGraphite": "The new drawing engine on the graphics card (experimental): can be smoother, can glitch",
    "--enable-features=ParallelDownloading": "Large downloads in several parts at once",
    "--num-raster-threads=4": "Number of threads for drawing. Edit the number after adding it",
    "--enable-unsafe-webgpu": "WebGPU",
    "--enable-features=Vulkan": "Draw with Vulkan (experimental)",
    "--disable-gpu": "No use of the graphics card at all (troubleshooting)"
  },
  moreActions: {
    duplicate: ["Duplicate", "A second app with the same settings and icon, without the logins"],
    showConfig: ["Show config file", "Its config.json, in the file manager"],
    showLog: ["Open the event log", "What the app did and when: pages loaded and why, reloads, failures, pauses"],
    clearData: ["Delete the app's data…", "Signs it out everywhere: deletes cookies and cache, keeps the settings"]
  },
  ui: {
    cancel: "Cancel",
    done: "Done",
    save: "Save",
    remove: "Remove",
    launch: "Launch",
    restart: "Restart",
    close: "Close",
    working: "Working",
    newApp: "New app",
    yourApps: "Your apps",
    noApps: "No apps yet.",
    brokenConfig: "Broken config file",
    settings: "Settings",
    chromeWebStore: "Chrome Web Store",
    findExtension: "Find an extension…",
    findExtensionLabel: "Find an extension",
    usage: { both: "{cpu}% CPU · {memory}", mb: "{amount} MB", gb: "{amount} GB" },
    apps: ["app", "apps"],
    icons: ["icon", "icons"],
    sidebar: {
      banner: "AppD-Manager",
      version: "Version {version}",
      by: "by {name}",
      home: "Home",
      extensions: "Extensions",
      settings: "Settings",
      smaller: "Make the sidebar smaller",
      larger: "Show the whole sidebar",
      order: "Order of the apps",
      find: "Find an app…",
      findLabel: "Find an app",
      exit: "Exit",
      exitTip: "Exit: closes AppD-Manager and every running app",
      running: "{name} (running: double-click to show its window)"
    },
    home: {
      title: "Your apps",
      nothingFound: "Nothing found",
      nothingFoundNote: "No app has that in its name or address.",
      noApps: "No apps yet",
      noAppsNote: "Any website can be an app of its own: in its own window, with its own icon and logins. Make the first one."
    },
    form: {
      newTitle: "New app",
      newOfKind: "New {kind}",
      newSub: "Enter a name and a URL, then save.",
      chooseKind: "What kind of app should it be? You can change it later, under General.",
      allAppsTitle: "Extension settings for all apps",
      tabs: "Parts of the settings",
      tabName: "Name",
      tabUrl: "Address",
      tabKeepAlive: "Never pause or unload this tab",
      tabAdd: "Add a tab",
      tabUp: "Move earlier",
      tabDown: "Move later",
      tabRemove: "Remove this tab",
      tabFirst: "Opens first, and is the app's address",
      tabLast: "A multi-tab app needs at least one tab",
      running: "Running",
      runningWith: "Running · {usage}",
      closeApp: "Close app",
      launchApp: "Launch app",
      more: "More",
      template: "Start from a template…",
      templateNote: "Fills in the name, address and suitable settings. You can still change everything.",
      icon: "Icon",
      iconPlaceholder: "Icon name or image file",
      iconFromSite: "Get from site",
      iconChoose: "Choose image…",
      iconNote: "The site's own icon, an image file (png, svg), or the name of a system icon such as ",
      iconExample: "mail-client",
      borderAuto: "Use the main colour of the app's icon",
      borderColour: "Border and glow colour",
      place: "Place on screen…",
      placed: "{x}% across, {y}% down",
      noExtensions: "None added.",
      addExtensions: "Add extensions…",
      extensionsNote: "Built-in extensions use the shared settings (Settings > Extension settings) until you change them here. Changes made here apply to this app only.",
      agentPresets: "Use a common user agent…",
      flagPresets: "Add a common flag…",
      chooseFolder: "Choose…",
      chooseFolderTitle: "Choose a folder",
      number: "Number",
      colour: "Colour",
      howLong: "How long",
      unit: "Unit of time",
      seconds: "seconds",
      minutes: "minutes",
      noKey: "None",
      holdKey: "Hold Ctrl, Alt, Shift or Super with the key.",
      seekBarColour: "Colour on the seek bar",
      colourOf: "Colour of {kind}"
    },
    said: {
      saved: "Saved.",
      savedEntry: "Saved. The menu entry is up to date.",
      removed: '"{name}" was removed.',
      undo: "Undo",
      back: '"{name}" is back.',
      templateUsed: '"{name}" filled in. Change what you like, then save. "Get from site" fetches its icon.',
      lookingForIcons: "Looking for the site's icons…",
      iconsFound: "Found {count}. Save to keep the selected one.",
      noIcon: "That site offers no icon.",
      dataDeleted: "The app's data was deleted.",
      copy: "This is the copy. Change what should differ, then save.",
      extensionAdded: "Added to {app}.",
      extensionRemoved: "Removed from {app}."
    },
    extensionBox: {
      gone: "Not in the library any more: it does not run.",
      own: ["{count} setting is this app's own; the rest follow the settings for all apps.", "{count} settings are this app's own; the rest follow the settings for all apps."],
      follows: "Follows the settings for all apps.",
      reset: "Use the settings for all apps",
      settings: "Settings"
    },
    sources: { builtin: "Built in", store: "Chrome Web Store", added: "Chrome Web Store, added by you", imported: "Imported by you" },
    extensions: {
      title: "Extensions",
      note: "Add-ons for your apps: ad blocking, extras for video and chat, dark mode. Open one to see what it does and to turn it on for your apps.",
      fromStore: "From the Chrome Web Store…",
      importFolder: "Import a folder…",
      kinds: "Kinds of extension",
      all: "All",
      inUse: "In use",
      yours: "Added by you",
      usedIn: "In {count}",
      none: "No extension has that in its name or description."
    },
    extension: {
      by: "by {name}",
      madeFor: "Made for {sites}.",
      anySite: "Works on any site.",
      fromStore: "From the Chrome Web Store: downloaded from Google's servers the first time an app needs it, and verified to be the genuine extension. Tested to work in an app.",
      whereToFind: "In apps that use it, find its menu and settings in the app's menu (right-click the page) under Extensions.",
      notTested: "Not tested. Apps are not a full Chrome browser: extensions that change pages usually work; ones that need the toolbar, tabs or sync often do not.",
      recommended: "Recommended",
      storePage: "Chrome Web Store page",
      sharedSettings: "Settings for all apps"
    },
    addExtension: {
      title: "From the Chrome Web Store",
      note: "Paste the link to an extension's Chrome Web Store page, or its ID. It is downloaded from Google's servers and verified to be the genuine extension.",
      field: "Link or ID",
      placeholder: "https://chromewebstore.google.com/detail/…",
      limits: "Apps are not a full Chrome browser: extensions that change pages usually work; ones that need the toolbar, tabs or sync often do not. The ones in the catalog have been tested.",
      trust: "Like in a browser, an extension can read and change the pages of the apps it is turned on for. Only add extensions you trust.",
      add: "Download and add"
    },
    picker: {
      title: "Extensions for {name}",
      thisApp: "this app",
      fitting: "Made for this site",
      rest: "All other extensions",
      toPage: "The Extensions page"
    },
    place: {
      title: "Window position",
      note: "Drag the window to where it should open, or click a screen. The arrow keys also move it.",
      window: "The window: drag it, or move it with the arrow keys",
      use: "Use this position",
      main: " · main",
      where: "Screen {screen}: {down}, {across}",
      left: "left",
      right: "right",
      top: "top",
      bottom: "bottom",
      middle: "middle",
      across: "{percent}% across",
      down: "{percent}% down"
    },
    broken: {
      cannotRead: "This app's config file cannot be read:",
      whatToDo: "Fix the file by hand, or remove the app."
    },
    release: { version: "Version {version}" },
    settingsPage: {
      title: "Settings",
      tabs: { general: "General", appearance: "Appearance", extensions: "Extension settings", updates: "Updates", about: "About" },
      behaviour: "Behaviour",
      appsFolder: "Apps folder",
      appsFolderNote: "Each app has its own folder in here. Changing the location moves your apps there, with their settings and logins. Close running apps first: they stay behind.",
      openFolder: "Open folder",
      changeFolder: "Change…",
      defaultFolder: "Use default",
      backup: "Backup",
      backupNote: "Every app's settings and icon, and the extension settings for all apps, in one file. Logins are not part of it: after importing, sign in again.",
      exportApps: "Export the apps…",
      importApps: "Import apps…",
      appearance: "Appearance",
      mode: "Light or dark",
      colours: "Colours",
      extensions: "Extensions",
      extensionsNote: "These settings apply to every app that uses the extension, unless an app overrides them. When you save, running apps that are affected can be restarted.",
      updates: "Updates",
      installed: "Installed version: {version}",
      check: "Check for updates",
      install: "Install {version}",
      releasePage: "Open release page",
      backupFirst: "Backup before updating",
      openBackups: "Open the backups folder",
      otherVersion: "Install another version",
      otherVersionNote: "Go back to an earlier release, or to any other one. Your apps stay; settings that the older version does not know are left alone by it.",
      version: "Version",
      lookingUp: "Looking up the versions…",
      lookupFailed: "The versions could not be looked up",
      beta: "beta",
      installThis: "Install this version",
      about: "Websites as apps of their own: each in its own window, with its own menu entry, icon and logins.",
      name: "AppD-Manager {version}",
      runsOn: "Runs on Electron {electron} (Chromium {chromium}).",
      madeBy: "Made by {name}",
      projectPage: "Project page"
    },
    update: {
      checking: "Checking…",
      available: "Version {version} is available.",
      availableBeta: "Beta version {version} is available.",
      newest: "You have the newest version!",
      newestBeta: "You have the newest version!",
      failed: "Could not check for updates: {why}",
      downloading: "Downloading…",
      updated: "Updated to {version}. Restarting…",
      installed: "Version {version} is installed. Restarting…",
      ask: "Install version {version}?",
      askDetail: "You have {current}. AppD-Manager restarts with version {version}; your apps are not touched.",
      askBackup: " A copy of what is there now is kept first.",
      askInstall: "Install {version}"
    }
  },
  manager: {
    windowTitle: "AppD-Manager",
    notAllowed: "Not allowed from here.",
    noLog: "Nothing is logged yet: the log starts the next time the app does.",
    noFile: "{file} does not exist.",
    unsaved: {
      message: "Save the changes?",
      detail: "The app you are editing has changes that are not saved.",
      buttons: ["Save", "Discard", "Cancel"]
    },
    save: { noName: "Give the app a name.", noUrl: "Give the app a URL." },
    restart: {
      message: ['Restart "{name}" now?', "Restart {count} running apps now?"],
      detail: [
        "The app is running and keeps the old settings until restarted. Restarting closes the window; anything not saved in the page is lost.",
        "{names} are running and keep the old settings until restarted. Restarting closes the window; anything not saved in the page is lost."
      ],
      now: ["Restart now", "Restart them now"],
      later: "Later",
      kept: ["The app keeps its old settings until it is started again.", "The running apps keep their old settings until they are started again."],
      done: ["The app restarts with the new settings, on the page it was on.", "The running apps restart with the new settings, each on the page it was on."]
    },
    remove: {
      message: 'Remove "{id}"?',
      detail: "This deletes {folder}, including the app's logins and data, and takes it out of the menu.",
      buttons: ["Remove", "Cancel"]
    },
    clearData: {
      message: 'Delete the data of "{name}"?',
      detail: "This signs the app out everywhere and deletes its cookies, cache and remembered window size. Its settings and icon stay. The app is closed first if it is running.",
      buttons: ["Delete the data", "Cancel"]
    },
    exit: {
      message: "Exit AppD-Manager?",
      detail: ["This also closes the app that is running.", "This also closes the {count} apps that are running."],
      buttons: ["Exit", "Cancel"]
    },
    folder: {
      fixed: "The location is fixed by the APPD_APPS_DIR environment variable.",
      moved: ["Moved 1 app.", "Moved {count} apps."],
      left: "Still in the old folder: {apps}."
    },
    backup: {
      exportTitle: "Export the apps",
      importTitle: "Import apps",
      fileKind: "AppD-Manager apps",
      exported: ["{count} app exported to {file}.", "{count} apps exported to {file}."],
      imported: ["{count} app imported: {apps}.", "{count} apps imported: {apps}."],
      importedNone: "0 apps imported.",
      leftOut: "Left out: {apps}.",
      unreadable: "That file cannot be read as exported apps."
    },
    pick: {
      icon: "Choose an icon",
      images: "Images",
      appsFolder: "Choose the folder that holds your apps",
      extensionFolder: "Choose the folder of an unpacked extension (it holds manifest.json)"
    },
    extension: {
      notOne: "That is neither a link to an extension in the Chrome Web Store nor the id of one (32 letters).",
      inCatalog: '"{name}" is in the catalog already.',
      notFetched: "The extension could not be fetched: {why}.",
      removeMessage: 'Remove the extension "{name}"?',
      removeDetail: "It is taken out of the library and out of every app that uses it.",
      removeButtons: ["Remove", "Cancel"]
    },
    update: {
      message: "AppD-Manager {version} is available",
      messageBeta: "AppD-Manager {version} is available (beta)",
      how: "You have {current}. Updating takes a moment and restarts AppD-Manager; your apps are not touched.",
      now: "Update now",
      later: "Later",
      ok: "OK",
      releasePage: "Open release page"
    }
  },
  app: {
    menu: {
      reload: "Reload",
      goHome: "Go to {name}",
      mute: "Mute sound",
      resetZoom: "Reset zoom ({percent}%)",
      fullScreen: "Full screen",
      keepOpen: "Keep open",
      hide: "Hide",
      quit: "Quit {name}",
      minimize: "Minimize",
      maximize: "Maximize",
      restoreSize: "Restore size",
      closeWindow: "Close window",
      close: "Close",
      openLink: "Open Link in Browser",
      copyLink: "Copy Link Address",
      copyImage: "Copy Image",
      copyImageAddress: "Copy Image Address"
    },
    actions: { "hard-reload": "Hard reload", "clear-cache": "Empty cache and hard reload" },
    trayActions: { toggle: "Show or hide the window" },
    leave: { message: "Leave this page?", detail: "It may have unsaved changes.", buttons: ["Leave", "Stay"] },
    homeButton: { label: "← {name}", tip: "Back to {name} (Alt+Home)" },
    tray: { quit: "Quit" },
    tab: { reload: "Reload tab", load: "Load tab", unload: "Unload tab (frees its memory)", pause: "Pause tab", resume: "Resume tab", copy: "Copy address", browser: "Open in the browser", next: "Next tab", previous: "Previous tab" },
    find: { placeholder: "Find in page", previous: "Previous (Shift+Enter)", next: "Next (Enter)", close: "Close (Escape)" },
    download: { finished: "Download finished", failed: "Download failed" },
    share: { title: "Share with this page:", screen: "Screen {number}", wholeScreen: "The whole screen", window: "A window", nothing: "Nothing" },
    extensions: {
      title: "Extensions",
      builtInSettings: "{name}: settings…",
      menu: "Menu…",
      settings: "Settings…",
      one: "{name}: {what}",
      nothing: "{name} (nothing to open)",
      more: "More extensions…"
    }
  },
  appTypes: {
    app: {
      name: "App",
      about: "A window of its own, with an entry in the desktop's menu and a place in the taskbar"
    },
    multitab: {
      name: "Multi-tab app",
      about: "One window with a bar of tabs, a site in each. Tabs you are not using can be slowed down, paused or unloaded to save memory and power"
    },
    tray: {
      name: "Tray app",
      about: "Sits in the system tray: a click on its icon opens a small window. Not in the menu, not in the taskbar"
    }
  },
  modes: { system: "As the desktop", light: "Light", dark: "Dark" },
  palettes: { ocean: "Ocean", indigo: "Indigo", violet: "Violet", teal: "Teal", forest: "Forest", amber: "Amber", coral: "Coral", rose: "Rose" },
  extensionKinds: { blocking: "Blocking", video: "Video", look: "Look", chat: "Chat and streams" },
  catalog: {
    adblock: {
      name: "Ad blocker",
      about: "Blocks ads and trackers on websites, and the ads in YouTube videos. Uses the filter lists uBlock Origin uses, refreshed daily."
    },
    twitch: {
      name: "Twitch ad blocker",
      about: "Removes the ads in Twitch streams, which the general blocker cannot reach. Uses the TwitchAdSolutions script, fetched from its project on GitHub."
    },
    sponsorblock: {
      name: "SponsorBlock",
      about: "Offers to skip, or skips, sponsor messages, intros and other parts of YouTube videos that viewers have marked."
    },
    darkreader: {
      name: "Dark Reader",
      about: "Gives sites a dark look, also those without one of their own."
    },
    ambientlight: {
      name: "Ambient light for YouTube",
      about: "A glow around YouTube videos in the colours of the picture. Its settings are in the YouTube player."
    },
    returndislike: {
      name: "Return YouTube Dislike",
      about: "Shows how many dislikes a YouTube video has again, from the counts its users gather."
    },
    unhook: {
      name: "Unhook",
      about: "Takes the distractions out of YouTube: recommended videos, Shorts, the home feed, comments, end screens - each one to choose."
    },
    enhancer: {
      name: "Enhancer for YouTube",
      about: "More controls in the YouTube player: volume and speed with the mouse wheel, a cinema mode, a pinned player, loops, and themes."
    },
    improveyoutube: {
      name: "Improve YouTube!",
      about: "A large set of switches for YouTube: layout, player defaults, quality, hiding parts of the page, shortcuts. Open source."
    },
    videospeed: {
      name: "Video Speed Controller",
      about: "Speeds any HTML5 video up or down with the keys (S, D, R, Z, X), with the speed shown in a corner of the player."
    },
    betterttv: {
      name: "BetterTTV",
      about: "More emotes and chat features for Twitch (and YouTube chat): BetterTTV emotes, split chat, highlights, and many small switches."
    },
    seventv: {
      name: "7TV",
      about: "7TV emotes, cosmetics and chat improvements for Twitch (and Kick and YouTube chat)."
    },
    frankerfacez: {
      name: "FrankerFaceZ",
      about: "FrankerFaceZ emotes and a great many settings for Twitch: chat, the player, the layout."
    }
  },
  sponsorKinds: {
    sponsor: "Sponsor messages",
    selfpromo: "Unpaid or self-promotion",
    interaction: "Reminders to like, subscribe or follow",
    intro: "Intros and title sequences",
    outro: "Endcards and credits",
    preview: "Recaps and previews",
    hook: "Hooks and greetings",
    filler: "Tangents and jokes",
    music_offtopic: "Non-music parts of music videos",
    poi_highlight: "Highlight (the point of the video)",
    exclusive_access: "Exclusive access (whole video)"
  },
  errors: {
    oneOf: '"{key}" must be one of: {values}',
    mustBeArray: '"{key}" must be an array',
    mustBe: '"{key}" must be a {type}',
    mustBeObject: '"{key}" must be an object',
    range: '"{key}" must be a number from {min} to {max}',
    badUrl: 'invalid url "{url}"',
    noTabs: "a multi-tab app needs at least one tab",
    badTab: "tab {number} must have a name and a url (and keepAlive, if any, true or false)",
    badTabUrl: 'tab {number} has an invalid address "{url}" (it must start with http:// or https://)',
    badId: 'invalid app id "{id}" (use a-z, 0-9, - and _)',
    unknownLook: "unknown mode or palette",
    unknownExtension: 'unknown extension "{name}" (known: {known})',
    unknownSponsorKind: 'unknown SponsorBlock category "{name}" in "{key}" (known: {known})',
    sponsorColour: '"sponsorBlockColors.{kind}" must be a colour like #00d400',
    hotkey: '"trayHotkey" must be a key combination like Super+Alt+Y or Ctrl+Shift+F9',
    language: '"language" must be a language code like en-GB or nb',
    downloadFolder: '"downloadFolder" must be a full path',
    customExtension: '"{entry}" in "customExtensions" is not an extension',
    proxy: '"proxy" must be an address like socks5://127.0.0.1:1080 or http://proxy.lan:3128',
    borderColour: '"windowBorderColor" must be a colour like #7a7f87, or empty for the colour of the icon',
    sponsorServer: '"sponsorBlockServer" must be an address starting with https://',
    notExtensionFolder: "{folder} is not an unpacked extension: it has no readable manifest.json.",
    notExtensionId: '"{id}" is not an extension id',
    extensionInLibrary: "That extension is in the library already.",
    badExtensionName: 'invalid extension name "{name}"',
    noApp: 'no app "{id}" (expected {file})',
    appAgain: 'There is an app "{id}" again already.',
    closeFirst: "Close the app first.",
    notExport: "This is not a file of exported AppD-Manager apps.",
    answered: "{status} for {url}",
    urlFirst: "Enter the URL of the app first.",
    noPicture: "no picture found",
    notPicture: "not a picture",
    sponsorAnswered: "the database answered {status}",
    storeAnswered: "the Chrome Web Store answered {status}",
    crxCutOff: "cut off",
    crxField: "unexpected field",
    notCrx: "not a CRX3 file",
    crxUnsigned: "no signed part",
    crxWrongKey: "it is not signed with the key of {id}",
    notZip: "not a zip",
    damagedZip: "damaged zip",
    zipPath: "unsafe path in the zip: {name}",
    zipCompression: "unknown compression in the zip: {name}",
    noManifest: "no manifest.json in it"
  },
  updating: {
    github: "GitHub answered {status} for {url}",
    notVersion: '"{tag}" is not a version.',
    upToDate: "AppD-Manager is already up to date.",
    notUnpacked: "Could not unpack the update: {why}",
    notBuild: "The download is not an AppD-Manager build.",
    fromSource: "This copy runs from the source folder and cannot install another version of itself.",
    notWritable: "AppD-Manager cannot write to its own folder ({folder}): move it to a folder of your own, or download the version from the release page.",
    packaged: "This copy was installed by the system's package manager, so its version is changed there: {command}",
    packageManager: "your system's package manager",
    otherRuntime: "Version {version} needs another runtime (Electron {needed}; this one is {have}): run the install script of that version."
  },
  library: {
    defaultDescription: "AppD Manager application",
    managerComment: "Add, change and remove web apps",
    copyName: "{name} (copy)",
    chromeExtension: "Chrome extension",
    notFetched: "Not fetched yet: it is fetched when an app that has it starts.",
    running: "{id} (running)",
    existsThere: "{id} (already exists there)",
    startMenuLater: "The Start menu is brought up to date the next time AppD-Manager is opened."
  },
  sponsor: {
    kinds: {
      sponsor: "Sponsor",
      selfpromo: "Self-promotion",
      interaction: "Interaction reminder",
      intro: "Intro",
      outro: "Endcards",
      preview: "Preview or recap",
      hook: "Hook",
      filler: "Tangent",
      music_offtopic: "Non-music part",
      poi_highlight: "Highlight",
      exclusive_access: "Exclusive access"
    },
    close: "Close",
    skipped: "Skipped: {kind}",
    unskip: "Unskip",
    muted: "Muted: {kind}",
    unmute: "Unmute",
    skip: "Skip",
    mute: "Mute",
    comingUp: "{kind} coming up",
    skipNow: "Skip now",
    dontSkip: "Don't skip",
    highlightAt: "Highlight at {time}",
    jump: "Jump there",
    jumped: "Jumped to the highlight",
    back: "Back",
    lengthTip: "Length without the marked segments",
    wholeVideo: "SponsorBlock: this whole video is marked as {kind}",
    exemptChannel: "SponsorBlock: nothing is skipped on this channel",
    lookupFailed: "SponsorBlock: could not look this video up ({why})",
    marked: ["SponsorBlock: {count} segment marked in this video", "SponsorBlock: {count} segments marked in this video"],
    nothingMarked: "SponsorBlock: nothing marked in this video"
  },
  templates: {
    "YouTube": "With the ad blocker and SponsorBlock",
    "YouTube TV": "The interface for televisions: arrow keys and a controller work",
    "YouTube Music": "With the ad blocker",
    "Twitch": "With both ad blockers",
    "Spotify": "The web player",
    "WhatsApp": "Stays in the tray, with the unread count on its icon",
    "Telegram": "Stays in the tray",
    "Discord": "Stays in the tray",
    "Google Translate": "A tray app: a small window that comes up from its icon in the tray",
    "Google Keep": "A tray app: notes behind an icon in the tray",
    "Gmail": "Google sign-in windows stay in the app",
    "Google Calendar": "Google sign-in windows stay in the app",
    "Outlook": "Mail and calendar",
    "Proton Mail": "Mail",
    "Home Assistant": "Put in the address of your own; shows the current state when you come back to it",
    "Home Assistant wall panel": "A dashboard for a screen on the wall: full screen, the screen stays on",
    "GitHub": "Code and issues"
  },
  cli: {
    usage: [
      "Usage:",
      "  appd [manager]                        open AppD-Manager (the GUI)",
      "  appd add <id> <url> [key=value ...]   create an app (and its menu entry)",
      "  appd set <id> key=value ...           change settings of an app",
      "  appd list                             show all apps",
      "  appd run <id>                         start an app",
      "  appd sync                             rebuild menu entries after editing files by hand",
      "  appd rm <id>                          remove an app, its folder and its data",
      "  appd version                          show the AppD-Manager version",
      "",
      "Keys: {keys}",
      "Apps folder: {folder}   (one folder per app, settings in <id>/config.json)",
      'Change it in the manager, or set "appsDir" in {settings}',
      "",
      "Example:",
      '  appd add mail https://mail.proton.me name="Proton Mail" icon=~/icons/proton.png'
    ],
    created: "Created {file}",
    unknownSetting: 'unknown setting "{pair}"',
    needsJson: '"{key}" needs a JSON value, got "{value}"',
    broken: "(broken: {why})"
  }
};
