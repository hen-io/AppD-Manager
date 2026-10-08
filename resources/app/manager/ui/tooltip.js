"use strict";
let tooltip = null;
let tooltipTimer = null;
function hideTooltip() {
  clearTimeout(tooltipTimer);
  if (tooltip) tooltip.remove();
  tooltip = null;
}
function showTooltip(el) {
  hideTooltip();
  if (!el.isConnected || !el.dataset.tip) return;
  tooltip = document.createElement("div");
  tooltip.id = "tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.textContent = el.dataset.tip;
  document.body.append(tooltip);
  const box = el.getBoundingClientRect();
  const own = tooltip.getBoundingClientRect();
  const below = box.bottom + 8 + own.height < window.innerHeight;
  tooltip.style.top = `${below ? box.bottom + 8 : box.top - 8 - own.height}px`;
  tooltip.style.left = `${Math.max(8, Math.min(box.left + box.width / 2 - own.width / 2, window.innerWidth - own.width - 8))}px`;
}
document.addEventListener("pointerover", (event) => {
  const el = event.target.closest("[title], [data-tip]");
  if (!el) return;
  if (el.title) {
    if (!el.getAttribute("aria-label") && !el.textContent.trim()) el.setAttribute("aria-label", el.title);
    el.dataset.tip = el.title;
    el.removeAttribute("title");
  }
  clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(() => showTooltip(el), 500);
});
for (const leaving of ["pointerout", "pointerdown", "keydown", "scroll"]) document.addEventListener(leaving, hideTooltip, true);
