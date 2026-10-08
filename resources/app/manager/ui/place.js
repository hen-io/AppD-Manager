"use strict";
const PLACE_MAP_WIDTH = 620;
const PLACE_MAP_HEIGHT = 340;
const CORNERS = { left: 0, center: 50, right: 100, top: 0, bottom: 100 };
function placeInForm() {
  const position = form.elements.trayPosition.value;
  const screen = Number(form.elements.trayScreen.value) || 0;
  if (position === "custom") return { screen, x: Number(form.elements.trayX.value), y: Number(form.elements.trayY.value) };
  const [vertical, horizontal] = position.split("-");
  return { screen, x: CORNERS[horizontal], y: CORNERS[vertical] };
}
function choosePlace(displays, size, start) {
  const box = $("place");
  const map = $("place-map");
  const left = Math.min(...displays.map((d) => d.bounds.x));
  const top = Math.min(...displays.map((d) => d.bounds.y));
  const right = Math.max(...displays.map((d) => d.bounds.x + d.bounds.width));
  const bottom = Math.max(...displays.map((d) => d.bounds.y + d.bounds.height));
  const scale = Math.min(PLACE_MAP_WIDTH / (right - left), PLACE_MAP_HEIGHT / (bottom - top));
  const drawn = (area) => ({ x: (area.x - left) * scale, y: (area.y - top) * scale, width: area.width * scale, height: area.height * scale });
  const put = (el, { x, y, width, height }) => Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` });
  map.style.width = `${(right - left) * scale}px`;
  map.style.height = `${(bottom - top) * scale}px`;
  const screens = displays.map((display, index) => {
    const el = document.createElement("div");
    el.className = "place-screen";
    put(el, drawn(display.bounds));
    const number = document.createElement("strong");
    number.textContent = String(index + 1);
    const about = document.createElement("span");
    about.textContent = `${display.bounds.width} × ${display.bounds.height}${display.primary ? " · main" : ""}`;
    el.append(number, about);
    const room = drawn(display.workArea);
    const width = Math.min(size.width, display.workArea.width) * scale;
    const height = Math.min(size.height, display.workArea.height) * scale;
    return { el, room, width, height };
  });
  const stand = document.createElement("div");
  stand.className = "place-window";
  stand.tabIndex = 0;
  stand.setAttribute("role", "slider");
  stand.setAttribute("aria-label", "The window: drag it, or move it with the arrow keys");
  stand.append(iconSvg("tray"));
  map.replaceChildren(...screens.map((screen) => screen.el), stand);
  let place = { screen: Math.min(Math.max(start.screen, 1), screens.length), x: start.x, y: start.y };
  const show = () => {
    const { room, width, height } = screens[place.screen - 1];
    put(stand, { x: room.x + (room.width - width) * place.x / 100, y: room.y + (room.height - height) * place.y / 100, width, height });
    screens.forEach((screen, index) => screen.el.classList.toggle("chosen", index === place.screen - 1));
    const across = place.x <= 2 ? "left" : place.x >= 98 ? "right" : Math.abs(place.x - 50) <= 2 ? "middle" : `${Math.round(place.x)}% across`;
    const down = place.y <= 2 ? "top" : place.y >= 98 ? "bottom" : Math.abs(place.y - 50) <= 2 ? "middle" : `${Math.round(place.y)}% down`;
    $("place-where").textContent = `Screen ${place.screen}: ${down}, ${across}`;
    stand.setAttribute("aria-valuetext", $("place-where").textContent);
  };
  const share = (value, low, room) => room > 0 ? Math.min(100, Math.max(0, (value - low) / room * 100)) : 0;
  const moveTo = (x, y) => {
    let best = 0;
    let bestGap = Infinity;
    screens.forEach(({ room: room2 }, index) => {
      const gap = Math.hypot(Math.max(room2.x - x, 0, x - (room2.x + room2.width)), Math.max(room2.y - y, 0, y - (room2.y + room2.height)));
      if (gap < bestGap) [best, bestGap] = [index, gap];
    });
    const { room, width, height } = screens[best];
    const snap = (value) => value < 4 ? 0 : value > 96 ? 100 : Math.abs(value - 50) < 3 ? 50 : Math.round(value);
    place = { screen: best + 1, x: snap(share(x - width / 2, room.x, room.width - width)), y: snap(share(y - height / 2, room.y, room.height - height)) };
    show();
  };
  let grip = null;
  stand.addEventListener("pointerdown", (event) => {
    const at = stand.getBoundingClientRect();
    grip = { x: event.clientX - (at.left + at.width / 2), y: event.clientY - (at.top + at.height / 2) };
    stand.setPointerCapture(event.pointerId);
    stand.classList.add("held");
  });
  stand.addEventListener("pointermove", (event) => {
    if (!grip) return;
    const at = map.getBoundingClientRect();
    moveTo(event.clientX - grip.x - at.left, event.clientY - grip.y - at.top);
  });
  for (const end of ["pointerup", "pointercancel"]) {
    stand.addEventListener(end, () => {
      grip = null;
      stand.classList.remove("held");
    });
  }
  map.addEventListener("pointerdown", (event) => {
    if (event.target === stand || stand.contains(event.target)) return;
    const at = map.getBoundingClientRect();
    moveTo(event.clientX - at.left, event.clientY - at.top);
  });
  stand.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 2;
    const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!by) return;
    event.preventDefault();
    place = { ...place, x: Math.min(100, Math.max(0, place.x + by[0])), y: Math.min(100, Math.max(0, place.y + by[1])) };
    show();
  });
  return new Promise((resolve) => {
    const done = (result) => {
      box.close();
      map.replaceChildren();
      resolve(result);
    };
    $("place-use").onclick = () => done(place);
    $("place-cancel").onclick = () => done(null);
    box.oncancel = (event) => {
      event.preventDefault();
      done(null);
    };
    box.showModal();
    show();
    stand.focus();
  });
}
async function placeTrayWindow() {
  let displays;
  try {
    displays = await call("displays");
  } catch (e) {
    return setStatus(e.message, true);
  }
  const start = placeInForm();
  if (!start.screen) start.screen = displays.findIndex((display) => display.primary) + 1 || 1;
  const size = { width: Number(form.elements.trayWidth.value), height: Number(form.elements.trayHeight.value) };
  const place = await choosePlace(displays, size, start);
  if (!place) return void 0;
  const set = (name, value) => {
    form.elements[name].value = String(value);
    form.elements[name].dispatchEvent(new Event("change", { bubbles: true }));
  };
  set("trayX", place.x);
  set("trayY", place.y);
  set("trayScreen", place.screen);
  set("trayPosition", "custom");
  return void 0;
}
