// Barra inferior, avisos y caja de selección.
import { state, canvas, ctx, stockpile, gameState, waveState, audio, toast, drag } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { hudButtons, toolbarButtons } from "../core/layout";
import { unitCost, canTrain } from "../systems/buildings";
import { selectedUnits } from "../systems/selection";

export function drawHud() {
  const top = canvas.height - HUD_HEIGHT;

  ctx.fillStyle = "rgba(8, 12, 16, 0.88)";
  ctx.fillRect(0, top, canvas.width, HUD_HEIGHT);

  ctx.strokeStyle = "#2c3a33";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, top + 0.5);
  ctx.lineTo(canvas.width, top + 0.5);
  ctx.stroke();

  // Madera
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(16, top + 22, 20, 20);
  ctx.strokeStyle = "#c98a4b";
  ctx.strokeRect(16.5, top + 22.5, 19, 19);

  ctx.fillStyle = "#e8e8e8";
  ctx.font = "16px system-ui";
  ctx.fillText(`Madera: ${Math.floor(stockpile.wood + 1e-9)}`, 46, top + 38);

  // Información de la selección
  ctx.font = "14px system-ui";
  if (state.selectedBuilding) {
    const label =
      state.selectedBuilding.type === "depot"
        ? "Centro de mando"
        : state.selectedBuilding.type === "tower"
        ? "Torre"
        : "Cuartel";

    ctx.fillStyle = "#e8e8e8";
    ctx.fillText(`${label} · vida ${Math.ceil(state.selectedBuilding.hp)}`, 220, top + 28);

    ctx.fillStyle = "#7d8794";
    ctx.font = "13px system-ui";

    if (state.selectedBuilding.type === "barracks") {
      const queued = Array.isArray(state.selectedBuilding.queue) ? state.selectedBuilding.queue.length : 0;
      ctx.fillText(`Cola: ${queued}`, 220, top + 48);
    } else if (state.selectedBuilding.type === "tower") {
      ctx.fillText(`Defensa automática · ${TOWER_DAMAGE} de daño`, 220, top + 48);
    } else {
      ctx.fillText("Entrega aquí la madera", 220, top + 48);
    }
  } else {
    ctx.fillStyle = "#aab4c0";
    ctx.fillText(`Seleccionadas: ${selectedUnits().length}`, 220, top + 28);
    ctx.fillStyle = "#7d8794";
    ctx.font = "13px system-ui";
    ctx.fillText("Clic derecho: mover · sobre el árbol: talar", 220, top + 48);
  }

  // Botones
  const buttons = hudButtons();
  if (state.selectedBuilding && state.selectedBuilding.type === "barracks") {
    drawHudButton(buttons.left, "Soldado", unitCost("soldier"), canTrain("soldier"));
    drawHudButton(buttons.right, "Arquero", unitCost("archer"), canTrain("archer"));
  } else {
    drawHudButton(buttons.left, "Cuartel", BARRACKS_COST, stockpile.wood >= BARRACKS_COST);
    drawHudButton(buttons.right, "Torre", TOWER_COST, stockpile.wood >= TOWER_COST);
  }
}

export function drawHudButton(rect, label, cost, enabled) {
  ctx.fillStyle = enabled ? "#2f4a3a" : "#1d2329";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.strokeStyle = enabled ? "#5b8a6a" : "#333b44";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

  ctx.fillStyle = enabled ? "#e8e8e8" : "#626b77";
  ctx.font = "14px system-ui";
  ctx.fillText(`${label} · ${cost}`, rect.x + 14, rect.y + 25);
}

export function drawWaveInfo() {
  if (gameState.victory || gameState.defeat) return;

  const seconds = Math.max(0, Math.ceil(waveState.timer));
  const label =
    waveState.number === 0
      ? `Primera oleada en ${seconds}s`
      : `Oleada ${waveState.number + 1} en ${seconds}s`;

  ctx.fillStyle = "rgba(8, 12, 16, 0.72)";
  ctx.fillRect(12, 10, 190, 28);

  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 1;
  ctx.strokeRect(12.5, 10.5, 189, 27);

  ctx.fillStyle = "#fca5a5";
  ctx.font = "14px system-ui";
  ctx.fillText(label, 22, 29);
}

export function drawToolbar() {
  const buttons = toolbarButtons();
  drawToolbarButton(buttons.sound, "Sonido", audio.enabled ? "#5b8a6a" : "#7f1d1d");
  drawToolbarButton(buttons.save, "Guardar");
  drawToolbarButton(buttons.load, "Cargar");
}

export function drawToolbarButton(rect, label, accent = undefined) {
  ctx.fillStyle = "rgba(10, 16, 22, 0.82)";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.strokeStyle = accent || "#3a4a5a";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

  ctx.fillStyle = "#cfd6df";
  ctx.font = "13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + 17);
  ctx.textAlign = "left";
}

export function drawToast() {
  if (toast.time <= 0) return;

  ctx.globalAlpha = Math.min(1, toast.time);
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(canvas.width / 2 - 110, 48, 220, 32);

  ctx.fillStyle = "#e8e8e8";
  ctx.font = "14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(toast.text, canvas.width / 2, 69);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

export function drawSelectionBox() {
  if (!drag.active || !drag.moved) return;

  const x = Math.min(drag.startScreenX, drag.endScreenX);
  const y = Math.min(drag.startScreenY, drag.endScreenY);
  const w = Math.abs(drag.endScreenX - drag.startScreenX);
  const h = Math.abs(drag.endScreenY - drag.startScreenY);

  ctx.fillStyle = "rgba(251, 191, 36, 0.12)";
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.setLineDash([]);                                // no dejar el trazo discontinuo para lo siguiente
}
