// Selección de unidades y edificios.
import { state, canvas, ctx, camera, units, buildings, drag, controlGroups } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { rectsOverlap, unitRect } from "../core/math";
import { screenToWorld, clampCamera } from "../core/view";

// Devuelve la unidad que contiene un punto del mundo, o null.
export function unitAt(worldX, worldY) {
  for (const unit of units) {
    if (
      worldX >= unit.x &&
      worldX <= unit.x + unit.size &&
      worldY >= unit.y &&
      worldY <= unit.y + unit.size
    ) {
      return unit;
    }
  }
  return null;
}

// Devuelve el cuartel que contiene un punto del mundo, o null.
export function buildingAt(worldX, worldY) {
  for (const building of buildings) {
    if (
      worldX >= building.x &&
      worldX <= building.x + building.size &&
      worldY >= building.y &&
      worldY <= building.y + building.size
    ) {
      return building;
    }
  }
  return null;
}

export function clearSelection() {
  for (const unit of units) {
    unit.selected = false;
  }
  state.selectedBuilding = null;
}

export function selectedUnits() {
  return units.filter((unit) => unit.selected);
}

// ¿Está la unidad dentro de la parte visible del mapa?
export function isOnScreen(unit) {
  const screenX = (unit.x + unit.size / 2 - camera.x) * camera.zoom;
  const screenY = (unit.y + unit.size / 2 - camera.y) * camera.zoom;
  return (
    screenX >= 0 &&
    screenX <= canvas.width &&
    screenY >= 0 &&
    screenY <= canvas.height - HUD_HEIGHT
  );
}

// Doble clic: selecciona todas las unidades del mismo tipo que se ven.
export function selectSameTypeOnScreen(type) {
  clearSelection();
  for (const unit of units) {
    if (unit.team !== TEAM_PLAYER || unit.type !== type) continue;
    if (isOnScreen(unit)) unit.selected = true;
  }
}

// Recupera un grupo de control y centra la cámara en él.
export function selectControlGroup(index) {
  clearSelection();

  const group = controlGroups[index].filter(
    (unit) => units.includes(unit) && unit.team === TEAM_PLAYER
  );
  for (const unit of group) {
    unit.selected = true;
  }

  if (group.length === 0) return;

  const averageX = group.reduce((sum, unit) => sum + unit.x + unit.size / 2, 0) / group.length;
  const averageY = group.reduce((sum, unit) => sum + unit.y + unit.size / 2, 0) / group.length;

  camera.x = averageX - canvas.width / 2 / camera.zoom;
  camera.y = averageY - (canvas.height - HUD_HEIGHT) / 2 / camera.zoom;
  clampCamera();
}

// Centra la vista en el centro de mando.
export function centerOnBase() {
  const base =
    buildings.find((building) => building.type === "depot" && building.hp > 0) ||
    buildings.find((building) => building.team === TEAM_PLAYER && building.hp > 0);
  const target = base || units.find((unit) => unit.team === TEAM_PLAYER);
  if (!target) return;

  camera.x = target.x + target.size / 2 - canvas.width / 2 / camera.zoom;
  camera.y = target.y + target.size / 2 - (canvas.height - HUD_HEIGHT) / 2 / camera.zoom;
  clampCamera();
}

// Caja de selección actual, ya convertida al mundo.
export function selectionBox() {
  const start = screenToWorld(drag.startScreenX, drag.startScreenY);
  const end = screenToWorld(drag.endScreenX, drag.endScreenY);
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y),
  };
}

// Al soltar el botón izquierdo decidimos si fue un clic o una caja.
export function finishDrag() {
  if (!drag.moved) {
    // Fue un clic: seleccionar lo que haya bajo el cursor.
    if (!drag.additive) clearSelection();
    const click = screenToWorld(drag.startScreenX, drag.startScreenY);

    const building = buildingAt(click.x, click.y);
    if (building && building.team === TEAM_PLAYER) {
      state.selectedBuilding = building;
      return;
    }
    if (building) return;          // los edificios enemigos no se seleccionan

    const hit = unitAt(click.x, click.y);
    if (hit && hit.team === TEAM_PLAYER) {
      const isDoubleClick =
        !drag.additive &&
        state.lastClick.type === hit.type &&
        state.elapsed - state.lastClick.time <= 0.35 &&
        Math.hypot(click.x - state.lastClick.x, click.y - state.lastClick.y) < 8;

      if (isDoubleClick) {
        selectSameTypeOnScreen(hit.type);
      } else {
        hit.selected = true;
      }

      state.lastClick = { type: hit.type, time: state.elapsed, x: click.x, y: click.y };
    } else {
      state.lastClick = { type: null, time: -1, x: -999, y: -999 };
    }
    return;
  }

  // Fue una caja: seleccionar todas las unidades del jugador que toca.
  if (!drag.additive) clearSelection();
  const box = selectionBox();
  for (const unit of units) {
    if (unit.team !== TEAM_PLAYER) continue;
    if (rectsOverlap(box, unitRect(unit))) {
      unit.selected = true;
    }
  }
}
