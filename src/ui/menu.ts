// Menú principal y pantalla de pausa.
import { state, canvas, ctx, gameState } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { menuButtons } from "../core/layout";
import { pointInRect } from "../core/math";
import { hasAutosave, startNewGame, loadGame } from "../systems/session";
import type { Rect } from "../core/types";

export function drawMenuButton(
  rect: Rect,
  label: string,
  detail: string,
  enabled = true
): void {
  ctx.fillStyle = enabled ? "rgba(47, 74, 58, 0.9)" : "rgba(29, 35, 41, 0.9)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.strokeStyle = enabled ? "#5b8a6a" : "#333b44";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

  ctx.fillStyle = enabled ? "#e8e8e8" : "#626b77";
  ctx.font = "18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + 28);

  ctx.fillStyle = "#8a94a6";
  ctx.font = "12px system-ui";
  ctx.fillText(detail, rect.x + rect.w / 2, rect.y + 44);
  ctx.textAlign = "left";
}

export function drawMenu(): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0b1016";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Cuadrícula decorativa
  ctx.strokeStyle = "rgba(74, 107, 82, 0.16)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#e8e8e8";
  ctx.font = "bold 44px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("MI PRIMER RTS", canvas.width / 2, 128);

  ctx.fillStyle = "#8a94a6";
  ctx.font = "15px system-ui";
  ctx.fillText("Tala, construye, defiende y destruye el campamento enemigo", canvas.width / 2, 164);

  const buttons = menuButtons();
  drawMenuButton(buttons.easy, "Fácil", "Más madera y oleadas lentas");
  drawMenuButton(buttons.normal, "Normal", "La experiencia equilibrada");
  drawMenuButton(buttons.hard, "Difícil", "Oleadas antes y más duras");

  const hasSave = hasAutosave();
  drawMenuButton(buttons.continue, "Continuar", hasSave ? "Retoma el autoguardado" : "No hay partida guardada", hasSave);

  ctx.fillStyle = "#7d8794";
  ctx.font = "12px system-ui";
  ctx.fillText("1 / 2 / 3 eligen dificultad · Se autoguarda al empezar cada oleada", canvas.width / 2, 538);
  ctx.textAlign = "left";
}

export function handleMenuClick(screenX: number, screenY: number): void {
  const buttons = menuButtons();

  if (pointInRect(screenX, screenY, buttons.easy)) {
    startNewGame("easy");
    return;
  }
  if (pointInRect(screenX, screenY, buttons.normal)) {
    startNewGame("normal");
    return;
  }
  if (pointInRect(screenX, screenY, buttons.hard)) {
    startNewGame("hard");
    return;
  }
  if (hasAutosave() && pointInRect(screenX, screenY, buttons.continue)) {
    loadGame(AUTOSAVE_KEY);
  }
}

export function drawPause(): void {
  if (!gameState.paused) return;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#e8e8e8";
  ctx.font = "bold 44px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Pausa", canvas.width / 2, canvas.height / 2 - 20);

  ctx.fillStyle = "#8a94a6";
  ctx.font = "15px system-ui";
  ctx.fillText("P: continuar · R: reiniciar · M: menú", canvas.width / 2, canvas.height / 2 + 24);
  ctx.textAlign = "left";
}
