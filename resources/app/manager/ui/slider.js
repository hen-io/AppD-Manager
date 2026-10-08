"use strict";
function addSlider(input) {
  if (!input.dataset.slider || input.closest(".number-field")) return;
  const slider = document.createElement("input");
  slider.type = "range";
  slider.tabIndex = -1;
  slider.setAttribute("aria-hidden", "true");
  const drawn = document.createElement("div");
  drawn.className = "slider";
  for (const part of ["wave", "rest", "handle"]) {
    const el = document.createElement("span");
    el.className = part;
    drawn.append(el);
  }
  drawn.append(slider);
  const field = document.createElement("div");
  field.className = "number-field";
  input.before(field);
  field.append(drawn, input);
  if (input.dataset.unit) {
    const unit = document.createElement("span");
    unit.className = "unit";
    unit.textContent = input.dataset.unit;
    field.append(unit);
  }
  const show = () => {
    const [from, to, step] = input.dataset.slider.split(" ").map(Number);
    Object.assign(slider, { min: from, max: to, step: step || 1 });
    const value2 = Math.min(to, Math.max(from, Number(input.value) || 0));
    slider.value = value2;
    drawn.style.setProperty("--fill", `${to > from ? (value2 - from) / (to - from) * 100 : 0}%`);
    slider.disabled = input.disabled;
    drawn.classList.toggle("off", input.disabled);
  };
  slider.addEventListener("input", () => {
    input.value = slider.value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  input.addEventListener("input", show);
  const value = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  Object.defineProperty(input, "value", {
    configurable: true,
    get() {
      return value.get.call(input);
    },
    set(next) {
      value.set.call(input, next);
      show();
    }
  });
  new MutationObserver(show).observe(input, { attributes: true, attributeFilter: ["disabled"] });
  show();
}
