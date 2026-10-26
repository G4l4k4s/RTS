// Minimapa interactivo.
import { state, canvas, ctx, camera, tree, buildings, units } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { pointInRect } from "../core/math";
import { isVisibleAt } from "../systems/fog";
import { clampCamera } from "../core/view";

export function minimapRect() {
  return {
    x: canvas.width - MINIMAP_WIDTH - 10,
    y: canvas.height - HUD_HEIGHT - MINIMAP_HEIGHT - 10,
    w: MINIMAP_WIDTH,
    h: MINIMAP_HEIGHT,
  };
}

export function drawMinimap() {
  const rect = minimapRect();
  const scaleX = MINIMAP_WIDTH / world.width;
  const scaleY = MINIMAP_HEIGHT / world.height;

  ctx.fillStyle = "rgba(4, 8, 12, 0.85)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

  // Árbol
  if (!tree.depleted) {
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(rect.x + tree.x * scaleX - 2, rect.y + tree.y * scaleY - 2, 4, 4);
  }

  // Edificios
  for (const building of buildings) {
    if (
      building.team === TEAM_ENEMY &&
      !isVisibleAt(building.x + building.size / 2, building.y + building.size / 2)
    ) {
      continue;
    }

    ctx.fillStyle = building.team === TEAM_ENEMY ? "#ef4444" : "#f59e0b";
    ctx.fillRect(
      rect.x + building.x * scaleX,
      rect.y + building.y * scaleY,
      Math.max(3, building.size * scaleX),
      Math.max(3, building.size * scaleY)
    );
  }

  // Unidades
  for (const unit of units) {
    if (unit.team === TEAM_ENEMY && !isVisibleAt(unit.x + unit.size / 2, unit.y + unit.size / 2)) {
      continue;
    }

    ctx.fillStyle = unit.team === TEAM_ENEMY ? "#ef4444" : "#3b82f6";
    ctx.fillRect(rect.x + unit.x * scaleX - 1, rect.y + unit.y * scaleY - 1, 3, 3);
  }

  // Rectángulo de la cámara
  const viewWidth = canvas.width / camera.zoom;
  const viewHeight = (canvas.height - HUD_HEIGHT) / camera.zoom;
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    rect.x + camera.x * scaleX,
    rect.y + camera.y * scaleY,
    viewWidth * scaleX,
    viewHeight * scaleY
  );
}

export function minimapClick(screenX, screenY) {
  const rect = minimapRect();
  if (!pointInRect(screenX, screenY, rect)) return false;

  const worldX = (screenX - rect.x) / (MINIMAP_WIDTH / world.width);
  const worldY = (screenY - rect.y) / (MINIMAP_HEIGHT / world.height);

  camera.x = worldX - canvas.width / 2 / camera.zoom;
  camera.y = worldY - (canvas.height - HUD_HEIGHT) / 2 / camera.zoom;
  clampCamera();
  return true;
}
