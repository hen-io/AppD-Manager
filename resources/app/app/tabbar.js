"use strict";
const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
module.exports = function barPage({ dark, hues, basic = false, position, icons, badges, names, collapse, logo, scale = 1, slide = 420 }) {
  const vertical = position === "left";
  const bottom = position === "bottom";
  const role = (light, darker, hue = "--hue") => `oklch(${dark ? darker[0] : light[0]}% calc(${dark ? darker[1] : light[1]} * var(--vivid)) var(${hue}))`;
  const surface = basic ? dark ? "#202124" : "#f1f3f4" : role([94, 0.04], [21.5, 0.046], "--hue-s");
  const ink = basic ? dark ? "#e8eaed" : "#202124" : role([14, 0.025], [95.5, 0.012], "--hue-s");
  const quiet = basic ? dark ? "#9aa0a6" : "#5f6368" : role([33, 0.06], [85, 0.045], "--hue-s");
  const line = basic ? dark ? "#3c4043" : "#dadce0" : role([77, 0.06], [42, 0.06], "--hue-s");
  const accent = basic ? dark ? "#8ab4f8" : "#1a5fd0" : role([44, 0.14], [84, 0.11], "--hue-2");
  const tone = basic ? dark ? "#2f3b52" : "#d6e3fb" : role([88, 0.11], [36, 0.13], "--hue-2");
  const onAccent = dark ? basic ? "#0b1b36" : role([0, 0], [24, 0.07], "--hue-2") : "#ffffff";
  const vars = Object.entries(hues).map(([name, value]) => `${name}: ${value};`).join(" ");
  return `<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="${dark ? "dark" : "light"}"><style>
    :root { ${vars} --surface: ${surface}; --ink: ${ink}; --quiet: ${quiet}; --line: ${line}; --accent: ${accent};
      --on-accent: ${onAccent}; --tone: ${tone}; --label-accent: ${accent}; }
    html { zoom: ${scale}; }
    * { box-sizing: border-box; }
    html { background: transparent !important; }
    body { transition: transform ${slide}ms cubic-bezier(.3, 0, .1, 1), opacity ${slide}ms ease; }
    html.peek body { transform: ${vertical ? "translateX(-102%)" : `translateY(${bottom ? "102%" : "-102%"})`}; opacity: 0; pointer-events: none; }
    html::before { content: ""; position: fixed; z-index: 2; border-radius: 4px; background: var(--accent); opacity: 0; transition: opacity ${slide}ms ease; pointer-events: none; ${vertical ? "left: 3px; top: 50%; width: 5px; height: 100px; transform: translateY(-50%);" : `${bottom ? "bottom" : "top"}: 3px; left: 50%; width: 100px; height: 5px; transform: translateX(-50%);`} }
    html.peek::before { opacity: 0; }
    html, body { height: 100%; margin: 0; overflow: hidden; background: var(--surface); color: var(--ink);
      font: 500 14px/20px system-ui, "Roboto", sans-serif; user-select: none; -webkit-user-select: none; }
    body { display: flex; flex-direction: ${vertical ? "column" : "row"}; align-items: center; border-${vertical ? "right" : bottom ? "top" : "bottom"}: 1px solid var(--line); }
    .logo { flex: none; width: 28px; height: 28px; object-fit: contain; border-radius: 7px; ${vertical ? "margin: 10px 0 4px;" : "margin: 0 6px 0 14px;"} pointer-events: none; }
    [role=tablist] { display: flex; flex-direction: ${vertical ? "column" : "row"}; ${vertical ? "flex: 1; min-height: 0; width: 100%;" : "flex: 1; min-width: 0; height: 100%;"} ${vertical ? "padding: 8px 8px; gap: 2px; overflow-y: auto;" : "overflow-x: auto;"} scrollbar-width: none; }
    [role=tablist]::-webkit-scrollbar { display: none; }
    button { all: unset; box-sizing: border-box; position: relative; display: flex; align-items: center; justify-content: flex-start; gap: 10px;
      ${vertical ? "height: 44px; padding: 0 14px 0 12px; border-radius: 22px; width: 100%;" : "flex: 0 0 185px; width: 185px; height: 100%; padding: 0 10px 0 14px;"}
      color: var(--quiet); cursor: pointer; overflow: hidden; transition: background .15s, color .15s, opacity .2s; }
    button + button::before { content: ""; position: absolute; background: var(--line); pointer-events: none; ${vertical ? "left: 14px; right: 14px; top: -1px; height: 1px;" : "left: 0; top: 24%; bottom: 24%; width: 1px;"} }
    ${vertical ? "button[aria-selected=true]::before, button[aria-selected=true] + button::before { opacity: 0; }" : ""}
    button:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    button[aria-selected=true] { color: var(--label-accent); ${vertical ? "background: var(--tone);" : ""} }
    ${vertical ? "" : `button::after { content: ""; position: absolute; ${bottom ? "top" : "bottom"}: 0; left: 14px; right: 14px; height: 3px;
      border-radius: ${bottom ? "0 0 3px 3px" : "3px 3px 0 0"}; background: var(--accent); transform: scaleX(0); transition: transform .22s cubic-bezier(.2, 0, 0, 1); }
    button[aria-selected=true]::after { transform: scaleX(1); }`}
    .face { flex: none; width: 20px; height: 20px; border-radius: 5px; object-fit: contain; }
    .letter { display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--accent) 30%, var(--surface)); color: var(--ink); font: 700 11px/1 system-ui, sans-serif; }
    .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge { flex: none; min-width: 18px; padding: 0 6px; border-radius: 9px; background: var(--accent); color: var(--on-accent); font: 700 11px/18px system-ui, sans-serif; text-align: center; }
    .mark { flex: none; width: 14px; height: 14px; fill: currentColor; opacity: .75; }
    button.small { flex: 0 0 auto; width: auto; min-width: 0; justify-content: center; ${vertical ? "width: auto; align-self: flex-start; padding: 0 12px;" : "padding: 0 14px;"} }
    button.small .name, button.small .badge, button.plain .name { display: none; }
    button.plain { flex: 0 0 auto; width: auto; min-width: 56px; justify-content: center; ${vertical ? "padding: 0 6px;" : "padding: 0 8px 0 14px;"} }
    .x { flex: none; display: block; margin-left: auto; width: 18px; height: 18px; border-radius: 50%; font: 400 15px/17px system-ui, sans-serif; text-align: center; color: var(--quiet); }
    .x:hover { background: color-mix(in srgb, var(--ink) 14%, transparent); color: var(--ink); }
    .glyph-svg { width: 20px; height: 20px; fill: currentColor; opacity: 1; }
    .glyph { display: grid; place-items: center; font: 16px/1 system-ui, "Noto Color Emoji", sans-serif; }
    button.idle { opacity: .6; }
    button.idle[aria-selected=true] { opacity: 1; }
    .bar { position: absolute; ${vertical ? "left: 14px; right: 14px; bottom: 2px;" : `left: 0; right: 0; ${bottom ? "top" : "bottom"}: 0;`} height: 2px; overflow: hidden; display: none; }
    button.loading .bar { display: block; }
    .bar::before { content: ""; position: absolute; inset: 0; width: 40%; border-radius: 2px; background: var(--accent); animation: slide 1.1s cubic-bezier(.65, 0, .35, 1) infinite; }
    @keyframes slide { from { transform: translateX(-110%); } to { transform: translateX(260%); } }
    .ripple { position: absolute; border-radius: 50%; background: color-mix(in srgb, var(--accent) 35%, transparent); transform: scale(0); animation: ripple .5s ease-out forwards; pointer-events: none; }
    @keyframes ripple { to { transform: scale(1); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
  </style><body>${logo ? `<img class="logo" alt="" src="${logo}" draggable="false">` : ""}<div role="tablist" id="tabs" aria-orientation="${vertical ? "vertical" : "horizontal"}"></div><script>
    const OPTIONS = ${json({ icons, badges, names, collapse })};
    const list = document.getElementById('tabs');
    const SPEAKER = 'M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77M16.5 12A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4M3 9v6h4l5 5V4L7 9z';
    const PAUSE = 'M14 19h4V5h-4M6 19h4V5H6z';
    const make = (tag, props = {}) => Object.assign(document.createElement(tag), props);
    const icon = (path, label) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('class', 'mark');
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shape.setAttribute('d', path);
      svg.append(shape);
      svg.append(Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'title'), { textContent: label }));
      return svg;
    };
    for (const name of ['mouseenter', 'mousemove', 'pointerenter']) document.documentElement.addEventListener(name, () => appdTabs.hover(true));
    document.documentElement.addEventListener('mouseleave', () => appdTabs.hover(false));
    function show(state) {
      document.documentElement.classList.toggle('peek', Boolean(state.peek));
      list.replaceChildren(...state.tabs.map((tab, index) => {
        const display = tab.display || (OPTIONS.names ? (OPTIONS.icons ? 'both' : 'name') : 'icon');
        const collapsed = OPTIONS.collapse && tab.state === 'unloaded';
        const showName = display !== 'icon';
        const showFace = display !== 'name' || collapsed;
        const button = make('button', { type: 'button', className: [tab.state !== 'live' && tab.state !== 'loading' ? 'idle' : '', tab.state === 'loading' ? 'loading' : '', OPTIONS.collapse && tab.state === 'unloaded' ? 'small' : '', showName ? '' : 'plain'].join(' ').trim() });
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(index === state.active));
        button.title = tab.name + (tab.state === 'paused' ? ' (paused)' : tab.state === 'unloaded' ? ' (not loaded)' : '');
        const letter = () => make('span', { className: 'face letter', textContent: tab.name.trim().charAt(0).toUpperCase() || '?' });
        if (!showFace) {
        } else if (tab.icon && tab.icon.kind === 'mdi') {
          const face = icon(tab.icon.value, '');
          face.setAttribute('class', 'face glyph-svg');
          face.removeChild(face.lastChild);
          button.append(face);
        } else if (tab.icon && tab.icon.kind === 'text') {
          button.append(make('span', { className: 'face glyph', textContent: tab.icon.value }));
        } else if (tab.icon && tab.icon.kind === 'image') {
          const face = make('img', { className: 'face', alt: '', src: tab.icon.value, draggable: false });
          face.addEventListener('error', () => face.replaceWith(letter()));
          button.append(face);
        } else {
          if (tab.favicon) {
            const face = make('img', { className: 'face', alt: '', src: tab.favicon, draggable: false });
            face.addEventListener('error', () => face.replaceWith(make('span', { className: 'face letter', textContent: tab.name.trim().charAt(0).toUpperCase() || '?' })));
            button.append(face);
          } else {
            button.append(make('span', { className: 'face letter', textContent: tab.name.trim().charAt(0).toUpperCase() || '?' }));
          }
        }
        if (showName) button.append(make('span', { className: 'name', textContent: tab.name }));
        if (OPTIONS.badges && tab.badge > 0) button.append(make('span', { className: 'badge', textContent: tab.badge > 99 ? '99+' : String(tab.badge) }));
        if (tab.audible) button.append(icon(SPEAKER, 'Playing sound'));
        else if (tab.state === 'paused') button.append(icon(PAUSE, 'Paused'));
        if (tab.state !== 'unloaded') {
          const close = make('span', { className: 'x', textContent: '×', title: 'Close tab' });
          close.addEventListener('click', (event) => { event.stopPropagation(); appdTabs.close(index); });
          close.addEventListener('pointerdown', (event) => event.stopPropagation());
          button.append(close);
        }
        button.append(make('span', { className: 'bar' }));
        button.addEventListener('pointerdown', (event) => {
          if (event.button !== 0) return;
          const box = button.getBoundingClientRect();
          const size = Math.max(box.width, box.height) * 2;
          const ripple = make('span', { className: 'ripple' });
          Object.assign(ripple.style, { width: size + 'px', height: size + 'px', left: event.clientX - box.left - size / 2 + 'px', top: event.clientY - box.top - size / 2 + 'px' });
          button.append(ripple);
          setTimeout(() => ripple.remove(), 520);
        });
        button.addEventListener('click', () => appdTabs.select(index));
        button.addEventListener('contextmenu', (event) => { event.preventDefault(); appdTabs.menu(index); });
        button.addEventListener('keydown', (event) => {
          const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
          if (!step) return;
          event.preventDefault();
          list.children[(index + step + state.tabs.length) % state.tabs.length]?.focus();
        });
        return button;
      }));
      const current = list.children[state.active];
      current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    appdTabs.onState(show);
    appdTabs.ready();
  <\/script>`;
};
