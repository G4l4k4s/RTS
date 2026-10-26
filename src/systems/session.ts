// Guardado, carga, reinicio, pausa y menú.
import { state, canvas, ctx, camera, units, tree, stockpile, buildings, obstacles, camp, depot, gameState, waveState, fog, buildMode, drag, effects, mouse, controlGroups, toast } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { createUnit } from "../entities/unit";
import { clearSelection } from "./selection";
import { updateFog } from "./fog";
import { clampCamera } from "../core/view";
import { findNearestOpponent } from "./combat";
import { goDeposit } from "./economy";
import { showToast } from "../core/feedback";
import type { Difficulty } from "../core/types";

export function hasAutosave(): boolean {
  try {
    return Boolean(localStorage.getItem(AUTOSAVE_KEY));
  } catch (error) {
    return false;
  }
}

export function saveGame(key: string = SAVE_KEY, silent = false): void {
  try {
    const data = {
      version: 1,
      difficulty: gameState.difficulty,
      camera: { x: camera.x, y: camera.y, zoom: camera.zoom },
      stockpile: { wood: stockpile.wood },
      tree: { wood: tree.wood, depleted: tree.depleted },
      victory: gameState.victory,
      defeat: gameState.defeat,
      wave: { number: waveState.number, timer: waveState.timer },
      units: units.map((unit) => ({
        x: unit.x,
        y: unit.y,
        team: unit.team,
        type: unit.type || "soldier",
        wave: Boolean(unit.wave),
        hp: unit.hp,
        maxHp: unit.maxHp,
        carrying: unit.carrying,
        cooldown: unit.cooldown,
        gatherOrder: unit.gatherOrder,
      })),
      buildings: buildings.map((building) => ({
        type: building.type,
        team: building.team,
        x: building.x,
        y: building.y,
        size: building.size,
        hp: building.hp,
        maxHp: building.maxHp,
        queue: Array.isArray(building.queue) ? [...building.queue] : [],
        progress: building.progress || 0,
        cooldown: building.cooldown || 0,
      })),
      camp: { alive: camp.alive, spawnTimer: camp.spawnTimer },
    };

    localStorage.setItem(key, JSON.stringify(data));
    if (!silent) showToast("Partida guardada");
  } catch (error) {
    if (!silent) showToast("No se pudo guardar");
  }
}

export function loadGame(key: string = SAVE_KEY): void {
  let data;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      showToast("No hay partida guardada");
      return;
    }
    data = JSON.parse(raw);
  } catch (error) {
    showToast("No se pudo cargar");
    return;
  }

  if (!data || data.version !== 1) {
    showToast("Partida incompatible");
    return;
  }

  gameState.scene = "playing";
  gameState.paused = false;
  const savedDifficulty = data.difficulty as Difficulty;
  gameState.difficulty = DIFFICULTIES[savedDifficulty] ? savedDifficulty : "normal";

  // Mundo y cámara
  camera.x = data.camera.x;
  camera.y = data.camera.y;
  camera.zoom = data.camera.zoom;
  stockpile.wood = data.stockpile.wood;
  tree.wood = data.tree.wood;
  tree.depleted = data.tree.depleted;
  gameState.victory = Boolean(data.victory);
  gameState.defeat = Boolean(data.defeat);
  waveState.number = data.wave ? data.wave.number || 0 : 0;
  waveState.timer =
    data.wave && Number.isFinite(data.wave.timer)
      ? data.wave.timer
      : (DIFFICULTIES[gameState.difficulty] || DIFFICULTIES.normal).firstWave;

  // Unidades
  units.length = 0;
  for (const saved of data.units) {
    // Partidas antiguas podían traer unidades sin equipo: por defecto, jugador.
    const team = saved.team === TEAM_ENEMY ? TEAM_ENEMY : TEAM_PLAYER;
    const unit = createUnit(saved.x, saved.y, team, saved.type || "soldier");
    unit.wave = Boolean(saved.wave);
    unit.maxHp = Number.isFinite(saved.maxHp) ? saved.maxHp : unit.maxHp;
    unit.hp = Number.isFinite(saved.hp) ? saved.hp : unit.maxHp;
    unit.carrying = saved.carrying || 0;
    unit.cooldown = saved.cooldown || 0;
    unit.gatherOrder = Boolean(saved.gatherOrder);
    units.push(unit);
  }

  // Las oleadas guardadas vuelven a buscar su objetivo.
  for (const unit of units) {
    if (unit.team === TEAM_ENEMY && unit.wave) {
      unit.attackTarget = findNearestOpponent(unit, Infinity);
    }
  }

  // Edificios: se reconstruyen desde cero (el campamento conserva su objeto).
  buildings.length = 0;
  obstacles.length = 0;
  if (!tree.depleted) obstacles.push(tree);

  camp.alive = Boolean(data.camp && data.camp.alive);
  camp.spawnTimer = data.camp ? data.camp.spawnTimer || 0 : 0;
  camp.hp = camp.maxHp;

  for (const saved of data.buildings) {
    if (saved.type === "camp") {
      camp.hp = saved.hp;
      camp.maxHp = saved.maxHp;
      if (camp.alive) {
        buildings.push(camp);
        obstacles.push(camp);
      }
      continue;
    }

    const building = {
      type: saved.type,
      team: saved.team,
      x: saved.x,
      y: saved.y,
      size: saved.size,
      hp: saved.hp,
      maxHp: saved.maxHp,
      queue: Array.isArray(saved.queue)
        ? saved.queue.slice()
        : saved.queue > 0
        ? Array(saved.queue).fill("soldier")
        : [],
      progress: saved.progress || 0,
      cooldown: saved.cooldown || 0,
    };
    buildings.push(building);
    obstacles.push(building);
  }

  if (camp.alive && !buildings.includes(camp)) {
    buildings.push(camp);
    obstacles.push(camp);
  }

  // Quien llevaba madera al guardar vuelve al centro de mando.
  for (const unit of units) {
    if (unit.carrying > 0) {
      unit.task = { type: "gather", phase: "toDepot", slot: null };
      goDeposit(unit);
    }
  }

  clearSelection();
  buildMode.active = false;
  drag.active = false;
  effects.length = 0;
  mouse.inside = false;
  updateFog();
  clampCamera();
  showToast("Partida cargada");
}

// Empieza una partida nueva con la dificultad indicada, sin recargar la página.
export function startNewGame(difficulty: Difficulty = "normal"): void {
  const preset = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;

  gameState.scene = "playing";
  gameState.paused = false;
  gameState.difficulty = difficulty;
  gameState.victory = false;
  gameState.defeat = false;

  stockpile.wood = preset.wood;

  tree.wood = WOOD_PER_TREE;
  tree.depleted = false;

  units.length = 0;
  for (const [x, y] of START_POSITIONS) {
    units.push(createUnit(x, y, TEAM_PLAYER));
  }

  buildings.length = 0;
  obstacles.length = 0;
  obstacles.push(tree);

  camp.alive = true;
  camp.hp = camp.maxHp;
  camp.spawnTimer = 0;
  buildings.push(camp);
  obstacles.push(camp);

  depot.hp = depot.maxHp;
  buildings.push(depot);
  obstacles.push(depot);

  waveState.number = 0;
  waveState.timer = preset.firstWave;

  fog.explored.fill(0);
  fog.visible.fill(0);
  updateFog();

  clearSelection();
  buildMode.active = false;
  drag.active = false;
  effects.length = 0;
  mouse.inside = false;
  state.fogTimer = 0;

  controlGroups.forEach((group) => {
    group.length = 0;
  });
  state.lastClick = { type: null, time: -1, x: -999, y: -999 };

  camera.x = 200;
  camera.y = 150;
  camera.zoom = 1;
  clampCamera();

  toast.time = 0;
}

// Reiniciar: vuelve a empezar con la misma dificultad, sin recargar.
export function restartGame() {
  if (gameState.scene === "menu") return;
  startNewGame(gameState.difficulty);
}

export function togglePause() {
  if (gameState.scene !== "playing") return;
  if (gameState.victory || gameState.defeat) return;
  gameState.paused = !gameState.paused;
}

export function goToMenu() {
  if (gameState.scene === "playing" && !gameState.victory && !gameState.defeat) {
    saveGame(AUTOSAVE_KEY, true);
  }
  gameState.scene = "menu";
  gameState.paused = false;
  clearSelection();
  buildMode.active = false;
  drag.active = false;
}
