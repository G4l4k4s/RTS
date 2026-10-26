// Entrada de teclado y ratón.
import { state, canvas, ctx } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { screenToWorld, clampCamera } from "../core/view";
import { finishDrag, clearSelection, selectControlGroup, centerOnBase, selectedUnits } from "../systems/selection";
import { showToast } from "../core/feedback";
import { issueMoveOrder } from "../systems/orders";
import {
  handleHudClick, updateBuildGhost, tryPlaceBuilding, cancelBuildMode, startBuildMode
} from "../systems/buildings";
import { togglePause, goToMenu, saveGame, loadGame, startNewGame, restartGame } from "../systems/session";
import { toggleSound } from "../systems/audio";
import { handleMenuClick } from "./menu";
import { minimapClick } from "../render/minimap";
import { toolbarButtons } from "../core/layout";
import { pointInRect } from "../core/math";

// Convierte la posición del ratón a coordenadas del canvas y del mundo.
// El factor de escala es por si algún día el CSS cambia el tamaño del canvas.
export function pointerPosition(event: MouseEvent): {
  screenX: number;
  screenY: number;
  x: number;
  y: number;
} {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const screenX = (event.clientX - rect.left) * scaleX;
  const screenY = (event.clientY - rect.top) * scaleY;
  const point = screenToWorld(screenX, screenY);
  return { screenX, screenY, x: point.x, y: point.y };
}

export function registerInput() {
// 6. Eventos
// ---------------------------------------------------------------------

// 6.1. Teclado
window.addEventListener("keydown", (event) => {
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();                 // las flechas no deben hacer scroll
  }

  if (state.gameState.scene === "menu") {
    if (event.key === "1") startNewGame("easy");
    else if (event.key === "2") startNewGame("normal");
    else if (event.key === "3") startNewGame("hard");
    return;
  }

  if (event.key.toLowerCase() === "p" && !event.repeat) {
    togglePause();
  }

  if (
    event.key.toLowerCase() === "m" &&
    !event.repeat &&
    !state.gameState.victory &&
    !state.gameState.defeat
  ) {
    goToMenu();
  }

  if (state.gameState.paused) return;

  // Espacio: centrar la vista en la base.
  if (event.key === " ") {
    event.preventDefault();
    centerOnBase();
    return;
  }

  // 1…9: grupos de control (Ctrl para guardar el grupo actual).
  const groupNumber = Number(event.key);
  if (groupNumber >= 1 && groupNumber <= 9) {
    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      state.controlGroups[groupNumber - 1] = selectedUnits();
      showToast(`Grupo ${groupNumber} guardado`);
    } else {
      selectControlGroup(groupNumber - 1);
    }
    return;
  }

  if (event.key === "Escape") {
    if (state.buildMode.active) {
      cancelBuildMode();
    } else {
      clearSelection();
    }
  }

  if (event.key.toLowerCase() === "b" && !event.repeat && !state.gameState.victory && !state.gameState.defeat) {
    startBuildMode("barracks");
  }

  if (event.key.toLowerCase() === "t" && !event.repeat && !state.gameState.victory && !state.gameState.defeat) {
    startBuildMode("tower");
  }

  if (
    (state.gameState.victory || state.gameState.defeat || state.gameState.paused) &&
    event.key.toLowerCase() === "r" &&
    !event.repeat
  ) {
    restartGame();
  }

  state.keys[event.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (event) => {
  state.keys[event.key.toLowerCase()] = false;
});

// Si la ventana pierde el foco (Alt+Tab), soltamos todo: si no, la cámara
// seguiría moviéndose sola al volver.
window.addEventListener("blur", () => {
  for (const key in state.keys) {
    state.keys[key] = false;
  }
  state.drag.active = false;
  state.mouse.inside = false;
});

// 6.2. Ratón
canvas.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;           // solo el botón izquierdo
  const p = pointerPosition(event);

  // Menú principal: elegir dificultad o continuar.
  if (state.gameState.scene === "menu") {
    handleMenuClick(p.screenX, p.screenY);
    return;
  }

  // Botones de guardado, arriba a la derecha.
  const toolbar = toolbarButtons();
  if (pointInRect(p.screenX, p.screenY, toolbar.sound)) {
    toggleSound();
    return;
  }
  if (pointInRect(p.screenX, p.screenY, toolbar.save)) {
    saveGame();
    return;
  }
  if (pointInRect(p.screenX, p.screenY, toolbar.load)) {
    loadGame();
    return;
  }

  // En pausa solo funcionan los botones de arriba.
  if (state.gameState.paused) return;

  // Minimapa: centra la cámara donde se hace clic.
  if (minimapClick(p.screenX, p.screenY)) return;

  // Partida terminada: no se dan órdenes al mapa.
  if (state.gameState.victory || state.gameState.defeat) return;

  // Clic en la barra inferior: botones del HUD.
  if (p.screenY >= canvas.height - HUD_HEIGHT) {
    handleHudClick(p.screenX, p.screenY);
    return;
  }

  // Clic mientras se coloca un cuartel: intentar construirlo.
  if (state.buildMode.active) {
    updateBuildGhost(p.x, p.y);
    tryPlaceBuilding();
    return;
  }

  state.drag.active = true;
  state.drag.additive = event.shiftKey;
  state.drag.moved = false;
  state.drag.startScreenX = p.screenX;
  state.drag.startScreenY = p.screenY;
  state.drag.endScreenX = p.screenX;
  state.drag.endScreenY = p.screenY;
});

// Escuchamos en window, no en el canvas: así el arrastre sigue funcionando
// aunque el ratón se salga del lienzo a mitad de la caja.
window.addEventListener("mousemove", (event) => {
  if (!state.drag.active) return;
  const p = pointerPosition(event);
  state.drag.endScreenX = p.screenX;
  state.drag.endScreenY = p.screenY;

  const distance = Math.hypot(state.drag.endScreenX - state.drag.startScreenX, state.drag.endScreenY - state.drag.startScreenY);
  if (distance > 4) {
    state.drag.moved = true;                      // más de 4 px: es una caja, no un clic
  }
});

window.addEventListener("mouseup", (event) => {
  if (event.button !== 0 || !state.drag.active) return;
  finishDrag();
  state.drag.active = false;
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();                   // quitar el menú contextual del navegador

  if (state.gameState.scene === "menu" || state.gameState.paused) return;

  const p = pointerPosition(event);

  if (state.gameState.victory || state.gameState.defeat) return;   // partida terminada

  // Clic derecho mientras se coloca: cancelar la construcción.
  if (state.buildMode.active) {
    cancelBuildMode();
    return;
  }

  if (p.screenY >= canvas.height - HUD_HEIGHT) return;   // clic en la interfaz
  issueMoveOrder(p.x, p.y, event.shiftKey);
});

// Seguimiento del ratón, para el scroll cuando se acerca a los bordes.
canvas.addEventListener("mousemove", (event) => {
  const p = pointerPosition(event);
  state.mouse.screenX = p.screenX;
  state.mouse.screenY = p.screenY;
  state.mouse.inside = true;

  if (state.buildMode.active) {
    updateBuildGhost(p.x, p.y);
  }
});

canvas.addEventListener("mouseleave", () => {
  state.mouse.inside = false;
});

// Rueda del ratón: zoom manteniendo el punto del mundo bajo el cursor.
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();

  if (state.gameState.scene !== "playing" || state.gameState.paused) return;

  const before = pointerPosition(event);
  const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.camera.zoom * factor));
  if (zoom === state.camera.zoom) return;

  state.camera.zoom = zoom;
  state.camera.x = before.x - before.screenX / zoom;
  state.camera.y = before.y - before.screenY / zoom;
  clampCamera();
}, { passive: false });

// ---------------------------------------------------------------------
}
