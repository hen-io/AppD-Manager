"use strict";
let closeMenu = () => {
};
function openMenu(select, button) {
  closeMenu();
  const options = [...select.options].filter((option, index) => !(index === 0 && option.value === ""));
  if (!options.length) return;
  const menu = document.createElement("div");
  menu.className = `picker-menu ${select.className.includes("mono") ? "mono" : ""}`;
  menu.setAttribute("role", "listbox");
  const items = options.map((option) => {
    const name = document.createElement("strong");
    name.textContent = option.text;
    const text = document.createElement("div");
    text.append(name);
    if (option.dataset.note) {
      const note = document.createElement("span");
      note.className = "note";
      note.textContent = option.dataset.note;
      text.append(note);
    }
    const item = document.createElement("div");
    item.className = "picker-item";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(option.selected && select.value !== ""));
    label(item, option.dataset.icon || "check", "");
    item.classList.toggle("lead", Boolean(option.dataset.icon));
    item.classList.toggle("divided", "divider" in option.dataset);
    item.append(text);
    item.addEventListener("click", () => choose(option));
    item.addEventListener("mousemove", () => activate(items.indexOf(item)));
    return item;
  });
  menu.append(...items);
  document.body.append(menu);
  const box = button.getBoundingClientRect();
  const below = window.innerHeight - box.bottom - 12;
  const above = box.top - 12;
  const up = below < Math.min(menu.scrollHeight, 220) && above > below;
  menu.style.minWidth = `${Math.max(box.width, 200)}px`;
  menu.style.maxWidth = `${Math.max(box.width, 460)}px`;
  menu.style.maxHeight = `${Math.min(420, up ? above : below)}px`;
  menu.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - menu.offsetWidth - 8))}px`;
  if (up) menu.style.bottom = `${window.innerHeight - box.top + 4}px`;
  else menu.style.top = `${box.bottom + 4}px`;
  let active = -1;
  function activate(index) {
    active = (index + items.length) % items.length;
    items.forEach((item, i) => item.classList.toggle("active", i === active));
    items[active].scrollIntoView({ block: "nearest" });
  }
  function choose(option) {
    close();
    select.value = option.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const keys = (event) => {
    if (event.key === "ArrowDown") activate(active + 1);
    else if (event.key === "ArrowUp") activate(active - 1);
    else if (event.key === "Home") activate(0);
    else if (event.key === "End") activate(items.length - 1);
    else if (event.key === "Enter" || event.key === " ") choose(options[active]);
    else if (event.key === "Escape" || event.key === "Tab") close();
    else if (event.key.length === 1) {
      const from = active + 1;
      const hit = [...options.keys()].map((i) => (i + from) % options.length).find((i) => options[i].text.replace(/^-+/, "").toLowerCase().startsWith(event.key.toLowerCase()));
      if (hit !== void 0) activate(hit);
      return;
    } else return;
    if (event.key !== "Tab") event.preventDefault();
    event.stopPropagation();
  };
  const outside = (event) => {
    if (!menu.contains(event.target) && event.target !== button && !button.contains(event.target)) close();
  };
  const away = (event) => {
    if (!menu.contains(event.target)) close();
  };
  function close() {
    menu.remove();
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", keys, true);
    document.removeEventListener("mousedown", outside, true);
    document.removeEventListener("scroll", away, true);
    window.removeEventListener("resize", close);
    closeMenu = () => {
    };
  }
  closeMenu = close;
  button.setAttribute("aria-expanded", "true");
  document.addEventListener("keydown", keys, true);
  document.addEventListener("mousedown", outside, true);
  document.addEventListener("scroll", away, true);
  window.addEventListener("resize", close);
  activate(Math.max(0, options.findIndex((option) => option.selected)));
}
function enhance(select) {
  if (select.classList.contains("picked")) return;
  select.classList.add("picked");
  const button = document.createElement("button");
  button.type = "button";
  button.className = `picker ${select.className.includes("mono") ? "mono" : ""}`;
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  if (select.getAttribute("aria-label")) button.setAttribute("aria-label", select.getAttribute("aria-label"));
  const text = document.createElement("span");
  label(button, "chevron", "");
  button.prepend(text);
  select.after(button);
  const show = () => {
    const option = select.selectedOptions[0];
    text.textContent = option ? option.text : "";
    button.classList.toggle("placeholder", !select.value);
    button.disabled = select.disabled;
    button.hidden = select.hidden;
  };
  const value = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  Object.defineProperty(select, "value", {
    configurable: true,
    get() {
      return value.get.call(select);
    },
    set(next) {
      value.set.call(select, next);
      show();
    }
  });
  select.addEventListener("change", show);
  select.closest("label")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) button.focus();
  });
  new MutationObserver(show).observe(select, { childList: true, attributes: true, attributeFilter: ["disabled", "hidden"] });
  button.addEventListener("click", () => button.getAttribute("aria-expanded") === "true" ? closeMenu() : openMenu(select, button));
  button.addEventListener("keydown", (event) => {
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && button.getAttribute("aria-expanded") !== "true") {
      event.preventDefault();
      openMenu(select, button);
    }
  });
  show();
}
