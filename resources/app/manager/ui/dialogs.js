"use strict";
function showRelease(box, release) {
  const named = release && release.name && release.name !== release.tag && release.name !== release.latest;
  box.hidden = !release || !named && !release.notes;
  if (box.hidden) return;
  const title = document.createElement("h4");
  title.textContent = named ? release.name : `Version ${release.latest}`;
  const version = document.createElement("span");
  version.className = "badge";
  version.textContent = release.tag || release.latest;
  const head = document.createElement("header");
  head.append(title, version);
  const notes = document.createElement("p");
  notes.className = "notes";
  notes.textContent = release.notes || "";
  box.replaceChildren(head, notes);
}
let asking = null;
window.ask = ({ message, detail, buttons, icon, cancel, danger, release }) => new Promise((resolve) => {
  const box = $("ask");
  if (asking) asking();
  label($("ask-message"), icon, message);
  showRelease($("ask-release"), release);
  $("ask-detail").textContent = detail || "";
  const answer = (index) => {
    asking = null;
    box.close();
    resolve(index);
  };
  asking = () => answer(cancel);
  $("ask-buttons").replaceChildren(...buttons.map((text, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    if (index === 0) button.className = danger ? "danger" : "primary";
    button.addEventListener("click", () => answer(index));
    return button;
  }));
  box.oncancel = (event) => {
    event.preventDefault();
    answer(cancel);
  };
  box.showModal();
  $("ask-buttons").children[danger ? cancel : 0].focus();
});
