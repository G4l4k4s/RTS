// Arnés compartido: carga el bundle de src/main.ts dentro de un DOM falso y
// devuelve el estado del juego junto con las herramientas para simular eventos
// y leer el dibujo.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadGame(options = {}) {
  const mainPath = path.join(__dirname, ".build", "game.js");
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

  // El bundle ya expone el estado interno en globalThis.__game.
  vm.runInNewContext(code, sandbox);

  const game = sandbox.__game;

  // Por defecto las pruebas arrancan una partida normal; el menú se prueba aparte.
  if (options.start !== false) {
    game.startNewGame("normal");
  }

  return {
    game,
    canvas,
    drawCalls,
    canvasListeners,
    windowListeners,
    storage,
  };
}

module.exports = { loadGame };
