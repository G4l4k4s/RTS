// Estado mutable central del juego.
// Los sistemas leen y modifican este objeto; así evitamos exportar `let`
// sueltos que no se pueden reasignar desde otros módulos.
import {
  CAMP_HP,
  CAMP_SIZE,
  FOG_COLS,
  FOG_ROWS,
  TEAM_ENEMY,
  TEAM_PLAYER,
  WAVE_FIRST_DELAY,
  WOOD_PER_TREE,
} from "./constants";

// Canvas y contexto 2D. Los tests inyectan un DOM falso antes de cargar esto.
export const canvas = document.getElementById("game") as HTMLCanvasElement;
export const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

export const state = {
  // Vista
  camera: { x: 200, y: 150, zoom: 1 },

  // Entidades
  units: [] as any[],
  tree: {
    x: 900,
    y: 500,
    size: 60,
    wood: WOOD_PER_TREE,
    maxWood: WOOD_PER_TREE,
    depleted: false,
  },
  stockpile: { wood: 0 },
  buildings: [] as any[],
  selectedBuilding: null as any,
  buildMode: { active: false, type: "barracks", x: 0, y: 0, valid: false },
  obstacles: [] as any[],

  camp: {
    type: "camp",
    team: TEAM_ENEMY,
    x: 1380,
    y: 220,
    size: CAMP_SIZE,
    hp: CAMP_HP,
    maxHp: CAMP_HP,
    alive: true,
    spawnTimer: 0,
  },
  depot: {
    type: "depot",
    team: TEAM_PLAYER,
    x: 440,
    y: 560,
    size: 100,
    hp: 500,
    maxHp: 500,
  },

  // Partida
  gameState: {
    scene: "menu", // menu | playing
    paused: false,
    difficulty: "normal",
    victory: false,
    defeat: false,
  },
  waveState: { number: 0, timer: WAVE_FIRST_DELAY },
  fog: {
    explored: new Uint8Array(FOG_COLS * FOG_ROWS),
    visible: new Uint8Array(FOG_COLS * FOG_ROWS),
  },
  fogTimer: 0,
  toast: { text: "", time: 0 },

  // Entrada y feedback
  audio: { context: null as any, enabled: true },
  keys: {} as Record<string, boolean>,
  drag: {
    active: false,
    additive: false,
    moved: false,
    startScreenX: 0,
    startScreenY: 0,
    endScreenX: 0,
    endScreenY: 0,
  },
  effects: [] as any[],
  controlGroups: Array.from({ length: 9 }, () => []) as any[][],
  lastClick: { type: null as any, time: -1, x: -999, y: -999 },
  mouse: { screenX: 0, screenY: 0, inside: false },
  elapsed: 0,
};

// Alias de los grupos de estado más usados.
// Son referencias a objetos/arrays: mutarlos aquí muta el estado central.
export const {
  camera,
  units,
  tree,
  stockpile,
  buildings,
  buildMode,
  obstacles,
  camp,
  depot,
  gameState,
  waveState,
  fog,
  toast,
  audio,
  keys,
  drag,
  effects,
  controlGroups,
  mouse,
} = state;
