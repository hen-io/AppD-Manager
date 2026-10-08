"use strict";
function floatLabel(label) {
  const first = label.firstChild;
  if (!first || first.nodeType !== Node.TEXT_NODE || !first.textContent.trim()) return;
  const control = label.querySelector(':scope > input:not([type="checkbox"]):not([data-slider]), :scope > textarea, :scope > select, :scope > .row > input');
  if (!control) return;
  const field = document.createElement("span");
  field.className = "field";
  const text = document.createElement("span");
  text.className = "float";
  text.textContent = first.textContent.trim();
  first.remove();
  control.before(field);
  field.append(control, text);
  if (control.tagName !== "SELECT" && !control.placeholder) control.placeholder = " ";
  if (control.tagName === "TEXTAREA") field.classList.add("tall");
}
const PRESSABLE = "button, summary, .app-card, .picker-item";
document.addEventListener("pointerdown", (event) => {
  const host = event.target.closest(PRESSABLE);
  if (!host || host.disabled) return;
  const box = host.getBoundingClientRect();
  const reach = Math.max(event.clientX - box.left, box.right - event.clientX, 1);
  const rise = Math.max(event.clientY - box.top, box.bottom - event.clientY, 1);
  const radius = Math.hypot(reach, rise);
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  Object.assign(ripple.style, {
    width: `${radius * 2}px`,
    height: `${radius * 2}px`,
    left: `${event.clientX - box.left - radius}px`,
    top: `${event.clientY - box.top - radius}px`
  });
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  host.style.overflow = "hidden";
  host.append(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
});
