"use strict";
const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
module.exports = function barPage({ dark, accent, position, icons, badges, names, collapse, logo }) {
  const vertical = position === "left";
  const bottom = position === "bottom";
  const surface = dark ? "#1b1d21" : "#f6f7fb";
  const ink = dark ? "#e4e6ec" : "#1c1e23";
  const quiet = dark ? "#a9adb8" : "#5a5f6a";
  const line = dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)";
  return `<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="${dark ? "dark" : "light"}"><style>
    :root { --surface: ${surface}; --ink: ${ink}; --quiet: ${quiet}; --line: ${line}; --accent: ${accent};
      --on-accent: ${dark ? "#101216" : "#ffffff"};
      --tone: color-mix(in srgb, var(--accent) ${dark ? 24 : 16}%, var(--surface));
      --label-accent: color-mix(in srgb, var(--accent) ${dark ? 62 : 82}%, ${dark ? "#ffffff" : "#000000"}); }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; overflow: hidden; background: var(--surface); color: var(--ink);
      font: 500 14px/20px system-ui, "Roboto", sans-serif; user-select: none; -webkit-user-select: none; }
    body { display: flex; flex-direction: ${vertical ? "column" : "row"}; align-items: center; border-${vertical ? "right" : bottom ? "top" : "bottom"}: 1px solid var(--line); }
    .logo { flex: none; width: 28px; height: 28px; object-fit: contain; border-radius: 7px; ${vertical ? "margin: 10px 0 4px;" : "margin: 0 6px 0 14px;"} pointer-events: none; }
    [role=tablist] { display: flex; flex-direction: ${vertical ? "column" : "row"}; ${vertical ? "flex: 1; min-height: 0; width: 100%;" : "flex: 1; min-width: 0; height: 100%;"} ${vertical ? "padding: 8px 8px; gap: 2px; overflow-y: auto;" : "overflow-x: auto;"} scrollbar-width: none; }
    [role=tablist]::-webkit-scrollbar { display: none; }
    button { all: unset; box-sizing: border-box; position: relative; display: flex; align-items: center; justify-content: ${vertical ? "flex-start" : "center"}; gap: 10px;
      ${vertical ? "height: 44px; padding: 0 14px 0 12px; border-radius: 22px; width: 100%;" : "flex: 1 1 0; min-width: 96px; max-width: 260px; height: 100%; padding: 0 16px;"}
      color: var(--quiet); cursor: pointer; overflow: hidden; transition: background .15s, color .15s, opacity .2s; }
    button:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    button[aria-selected=true] { color: var(--label-accent); ${vertical ? "background: var(--tone);" : ""} }
    ${vertical ? "" : `button::after { content: ""; position: absolute; ${bottom ? "top" : "bottom"}: 0; left: 14px; right: 14px; height: 3px;
      border-radius: ${bottom ? "0 0 3px 3px" : "3px 3px 0 0"}; background: var(--accent); transform: scaleX(0); transition: transform .22s cubic-bezier(.2, 0, 0, 1); }
    button[aria-selected=true]::after { transform: scaleX(1); }`}
    .face { flex: none; width: 20px; height: 20px; border-radius: 5px; object-fit: contain; }
    .letter { display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--accent) 30%, var(--surface)); color: var(--ink); font: 700 11px/1 system-ui, sans-serif; }
    .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge { flex: none; min-width: 18px; padding: 0 6px; border-radius: 9px; background: var(--accent); color: var(--on-accent); font: 700 11px/18px system-ui, sans-serif; text-align: center; }
    .mark { flex: none; width: 14px; height: 14px; fill: currentColor; opacity: .75; }
    button.small { flex: 0 0 auto; min-width: 0; ${vertical ? "width: auto; align-self: flex-start; padding: 0 12px;" : "padding: 0 14px;"} }
    button.small .name, button.small .badge, button.plain .name { display: none; }
    button.plain { flex: 0 0 auto; min-width: 56px; ${vertical ? "justify-content: center; padding: 0;" : "padding: 0 18px;"} }
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
    function show(state) {
      list.replaceChildren(...state.tabs.map((tab, index) => {
        const button = make('button', { type: 'button', className: [tab.state !== 'live' && tab.state !== 'loading' ? 'idle' : '', tab.state === 'loading' ? 'loading' : '', OPTIONS.collapse && tab.state === 'unloaded' ? 'small' : '', OPTIONS.names ? '' : 'plain'].join(' ').trim() });
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(index === state.active));
        button.title = tab.name + (tab.state === 'paused' ? ' (paused)' : tab.state === 'unloaded' ? ' (not loaded)' : '');
        const letter = () => make('span', { className: 'face letter', textContent: tab.name.trim().charAt(0).toUpperCase() || '?' });
        if (tab.icon && tab.icon.kind === 'mdi') {
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
        } else if (OPTIONS.icons || !OPTIONS.names || (OPTIONS.collapse && tab.state === 'unloaded')) {
          if (tab.favicon) {
            const face = make('img', { className: 'face', alt: '', src: tab.favicon, draggable: false });
            face.addEventListener('error', () => face.replaceWith(make('span', { className: 'face letter', textContent: tab.name.trim().charAt(0).toUpperCase() || '?' })));
            button.append(face);
          } else {
            button.append(make('span', { className: 'face letter', textContent: tab.name.trim().charAt(0).toUpperCase() || '?' }));
          }
        }
        button.append(make('span', { className: 'name', textContent: tab.name }));
        if (OPTIONS.badges && tab.badge > 0) button.append(make('span', { className: 'badge', textContent: tab.badge > 99 ? '99+' : String(tab.badge) }));
        if (tab.audible) button.append(icon(SPEAKER, 'Playing sound'));
        else if (tab.state === 'paused') button.append(icon(PAUSE, 'Paused'));
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
