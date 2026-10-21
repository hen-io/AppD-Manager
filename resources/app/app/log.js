"use strict";
const fs = require("fs");
const KEEP = 200;
const MOST = 300;
module.exports = function openLog(file) {
  const trim = () => {
    try {
      const kept = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
      if (kept.length > MOST) fs.writeFileSync(file, `${kept.slice(-KEEP).join("\n")}
`);
    } catch {
    }
  };
  trim();
  let written = 0;
  let writing = Promise.resolve();
  function note(text) {
    const now = /* @__PURE__ */ new Date();
    const stamp = `${now.toLocaleDateString("sv")} ${now.toLocaleTimeString("sv")}`;
    const line = `${stamp}  ${text}
`;
    const cut = ++written % (MOST - KEEP) === 0;
    writing = writing.then(() => fs.promises.appendFile(file, line)).catch(() => {
    }).then(() => cut && trim());
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
