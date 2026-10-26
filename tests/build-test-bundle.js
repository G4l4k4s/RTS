// Compila src/test-entry.ts a un bundle que las pruebas pueden ejecutar dentro
// del DOM falso. El entry expone el estado interno en globalThis.__game.
const path = require("path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");
const outDir = path.join(__dirname, ".build");
const outFile = path.join(outDir, "game.js");

esbuild.buildSync({
  entryPoints: [path.join(root, "src", "test-entry.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: outFile,
  logLevel: "warning",
});

console.log("Bundle de pruebas generado en tests/.build/game.js");
