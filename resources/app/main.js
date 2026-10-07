"use strict";
const run = process.argv.find((arg) => arg.startsWith("--appd-run="));
if (run) process.env.APPD_ID = run.slice("--appd-run=".length);
require(process.env.APPD_ID ? "./webapp" : "./manager");
