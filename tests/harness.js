// Arnés compartido: carga main.js dentro de un DOM falso y devuelve el estado
// del juego junto con las herramientas para simular eventos y leer el dibujo.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadGame() {
  const mainPath = path.join(__dirname, "..", "main.js");
  const code = fs.readFileSync(mainPath, "utf8");

  // Registro de llamadas de dibujo (para comprobar qué se pinta y dónde).
  const drawCalls = [];

  function makeCtx() {
    return new Proxy(
      {},
      {
        get(target, prop) {
          if (prop in target) return target[prop];
          return (...args) => drawCalls.push([prop, ...args]);
        },
        set(target, prop, value) {
          target[prop] = value;
          return true;
        },
      }
    );
  }

  const canvasListeners = {};
  const windowListeners = {};

  const canvas = {
    width: 800,
    height: 600,
    getContext: () => makeCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener(type, fn) {
      (canvasListeners[type] ||= []).push(fn);
    },
  };

  const windowStub = {
    addEventListener(type, fn) {
      (windowListeners[type] ||= []).push(fn);
    },
  };

  // localStorage falso: cada carga de partida empieza con el almacén vacío.
  const storage = new Map();

  const sandbox = {
    document: { getElementById: (id) => (id === "game" ? canvas : null) },
    window: windowStub,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    console: { log() {}, warn() {}, error() {} },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
  };
  sandbox.globalThis = sandbox;

  // Se expone el estado interno para poder comprobarlo desde las pruebas.
  const hook =
    "\n;globalThis.__game = {" +
    "units, camera, drag, effects, update, render, issueMoveOrder, clearSelection, selectedUnits," +
    "keys, gameLoop, tree, world, stockpile, obstacles, mouse, screenToWorld, clampCamera," +
    "buildings, buildMode, getSelectedBuilding: () => selectedBuilding, camp, gameState," +
    "waveState, createUnit, toast, saveGame, loadGame, canStand" +
    "};";

  vm.runInNewContext(code + hook, sandbox);

  return {
    game: sandbox.__game,
    canvas,
    drawCalls,
    canvasListeners,
    windowListeners,
    storage,
  };
}

module.exports = { loadGame };
