// Compila src/main.ts a un bundle que las pruebas pueden ejecutar dentro del
// DOM falso. Así los tests no dependen de un main.js duplicado.
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src");
const outDir = path.join(__dirname, ".build");
const outFile = path.join(outDir, "game.js");

const source = fs.readFileSync(path.join(srcDir, "main.ts"), "utf8");

// Este bloque se añade al final del mismo módulo para exponer el estado interno.
const hook = `
;globalThis.__game = {
  units, camera, drag, effects, update, render, issueMoveOrder, clearSelection, selectedUnits,
  keys, gameLoop, tree, world, stockpile, obstacles, mouse, screenToWorld, clampCamera,
  buildings, buildMode, getSelectedBuilding: () => selectedBuilding, camp, gameState,
  waveState, fog, updateFog, isVisibleAt, isExploredAt, minimapRect, minimapClick,
  audio, createUnit, toast, saveGame, loadGame, canStand, startNewGame, menuButtons,
  handleMenuClick, togglePause, goToMenu, hasAutosave, DIFFICULTIES, AUTOSAVE_KEY
};
`;

fs.mkdirSync(outDir, { recursive: true });

esbuild.buildSync({
  stdin: {
    contents: source + hook,
    loader: "ts",
    resolveDir: srcDir,
    sourcefile: "main.ts",
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: outFile,
  logLevel: "warning",
});

console.log("Bundle de pruebas generado en tests/.build/game.js");
