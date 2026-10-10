"use strict";
const text = require("./strings");
function fill(wording, values = {}) {
  return String(wording).replace(/\{(\w+)\}/g, (whole, name) => name in values ? values[name] : whole);
}
function counted(forms, number, values = {}) {
  return fill(forms[number === 1 ? 0 : 1], { count: number, ...values });
}
module.exports = { text, fill, counted };
