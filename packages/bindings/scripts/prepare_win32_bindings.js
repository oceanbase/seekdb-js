const path = require("path");
const { prepareWin32BindingsDir } = require("../pkgs/js-bindings/download.js");

prepareWin32BindingsDir(path.join(__dirname, "../pkgs/js-bindings"));
