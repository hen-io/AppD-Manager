"use strict";
const TIME_SLIDER_MOST = 120;
function addTimeField(holder) {
  if (holder.showTime) return;
  const [least, most] = holder.dataset.time.split(" ").map(Number);
  const amount = document.createElement("input");
  amount.type = "number";
  amount.step = "1";
  amount.setAttribute("aria-label", holder.dataset.label || "How long");
  const unit = document.createElement("select");
  unit.setAttribute("aria-label", "Unit of time");
  unit.append(new Option("seconds", "1"), new Option("minutes", "60"));
  const field = document.createElement("div");
  field.className = "time-field";
  field.append(amount, unit);
  holder.after(field);
  const range = () => {
    const per = Number(unit.value);
    const low = least > 0 ? Math.max(1, Math.ceil(least / per)) : 0;
    const high = Math.max(low, Math.floor(most / per));
    amount.min = String(low);
    amount.max = String(high);
    amount.dataset.slider = `${low} ${Math.min(high, TIME_SLIDER_MOST)} 1`;
  };
  const store = () => {
    const seconds = Math.round(Number(amount.value) || 0) * Number(unit.value);
    holder.value = String(Math.min(most, Math.max(least, seconds)));
  };
  amount.addEventListener("input", store);
  unit.addEventListener("change", () => {
    range();
    amount.value = String(Math.min(Number(amount.max), Math.max(Number(amount.min), Number(amount.value) || 0)));
    store();
  });
  holder.showTime = () => {
    const seconds = Number(holder.value) || 0;
    const per = seconds >= 60 && seconds % 60 === 0 ? 60 : 1;
    unit.value = String(per);
    range();
    amount.value = String(seconds / per);
    amount.disabled = holder.disabled;
    unit.disabled = holder.disabled;
  };
  new MutationObserver(holder.showTime).observe(holder, { attributes: true, attributeFilter: ["disabled"] });
  range();
}
