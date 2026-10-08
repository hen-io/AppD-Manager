"use strict";
const fs = require("fs");
module.exports = function openLog(file) {
  try {
    const kept = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
    if (kept.length > 300) fs.writeFileSync(file, `${kept.slice(-200).join("\n")}
`);
  } catch {
  }
  function note(text) {
    const now = /* @__PURE__ */ new Date();
    const stamp = `${now.toLocaleDateString("sv")} ${now.toLocaleTimeString("sv")}`;
    fs.appendFile(file, `${stamp}  ${text}
`, () => {
    });
  }
  let reason = "";
  const because = (why) => {
    reason = why;
    setTimeout(() => {
      if (reason === why) reason = "";
    }, 3e3);
  };
  const takeReason = () => {
    const why = reason;
    reason = "";
    return why;
  };
  const plain = (url) => String(url).replace(/[?#].*$/, "");
  return { note, because, takeReason, plain };
};
