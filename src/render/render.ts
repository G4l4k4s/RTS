// Dibujo del mundo y de las capas de interfaz.
import { state, canvas, ctx, camera, units, tree, buildings, buildMode, gameState, fog, effects } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { isVisibleAt, fogIndex } from "../systems/fog";
import { drawMenu, drawPause } from "../ui/menu";
import {
  drawHud, drawWaveInfo, drawToolbar, drawToast, drawSelectionBox
} from "../ui/hud";
import { drawMinimap } from "./minimap";
import type { Building } from "../core/types";

// La cuadrícula se dibuja en coordenadas del mundo: la transformación del
// render ya le aplica la cámara y el zoom.
export function drawGrid() {
  ctx.strokeStyle = "#3a5a42";
  ctx.lineWidth = 1 / camera.zoom;

  for (let x = 0; x <= world.width; x += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }

  for (let y = 0; y <= world.height; y += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }
}

export function drawTree() {
  if (tree.depleted) {
    // Tocón: el árbol ya se taló.
    ctx.fillStyle = "#6b4a24";
    ctx.fillRect(tree.x + tree.size * 0.2, tree.y + tree.size * 0.55, tree.size * 0.6, tree.size * 0.3);
    return;
  }

  // Tronco
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(tree.x + tree.size * 0.35, tree.y + tree.size * 0.5, tree.size * 0.3, tree.size * 0.5);

  // Copa
  ctx.fillStyle = "#2f6b3d";
  ctx.beginPath();
  ctx.arc(tree.x + tree.size / 2, tree.y + tree.size / 2, tree.size * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Barra con la madera que le queda
  const ratio = tree.wood / tree.maxWood;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(tree.x, tree.y - 14, tree.size, 8);
  ctx.fillStyle = "#8fce6b";
  ctx.fillRect(tree.x, tree.y - 14, tree.size * ratio, 8);
}

export function drawBuildings() {
  for (const building of buildings) {
    if (building.team === TEAM_ENEMY && !isVisibleAt(building.x + building.size / 2, building.y + building.size / 2)) {
      continue;
    }

    if (building.type === "camp") {
      drawCamp(building);
      continue;
    }

    if (building.type === "depot") {
      drawDepot(building);
      continue;
    }

    if (building.type === "tower") {
      drawTower(building);
      continue;
    }

    // Base y tejado
    ctx.fillStyle = "#6b4a2c";
    ctx.fillRect(building.x, building.y, building.size, building.size);
    ctx.fillStyle = "#a97c50";
    ctx.fillRect(building.x + 8, building.y + 8, building.size - 16, building.size - 16);

    // Puerta
    ctx.fillStyle = "#3d2a17";
    ctx.fillRect(building.x + building.size / 2 - 10, building.y + building.size - 24, 20, 24);

    // Marca de selección
    if (building === state.selectedBuilding) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3 / camera.zoom;
      ctx.strokeRect(building.x - 2, building.y - 2, building.size + 4, building.size + 4);
    }

    // Barra de la unidad que se está entrenando
    if (Array.isArray(building.queue) && building.queue.length > 0) {
      const ratio = building.progress / TRAIN_TIME;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(building.x, building.y - 14, building.size, 8);
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(building.x, building.y - 14, building.size * ratio, 8);
    }

    drawBuildingHealth(building);
  }
}

export function drawDepot(building: Building): void {
  ctx.fillStyle = "#3b4a5a";
  ctx.fillRect(building.x, building.y, building.size, building.size);

  ctx.fillStyle = "#5b7189";
  ctx.fillRect(building.x + 8, building.y + 8, building.size - 16, building.size - 16);

  // Tejado azul
  ctx.fillStyle = "#93c5fd";
  ctx.beginPath();
  ctx.moveTo(building.x - 6, building.y + 12);
  ctx.lineTo(building.x + building.size / 2, building.y - 18);
  ctx.lineTo(building.x + building.size + 6, building.y + 12);
  ctx.closePath();
  ctx.fill();

  // Puerta
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(building.x + building.size / 2 - 12, building.y + building.size - 30, 24, 30);

  if (building === state.selectedBuilding) {
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3 / camera.zoom;
    ctx.strokeRect(building.x - 2, building.y - 2, building.size + 4, building.size + 4);
  }

  drawBuildingHealth(building);
}

export function drawTower(building: Building): void {
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(building.x, building.y, building.size, building.size);

  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(building.x + 8, building.y + 8, building.size - 16, building.size - 16);

  // Almenas del tejado
  ctx.fillStyle = "#6b7280";
  const notch = building.size / 5;
  for (let i = 0; i < 5; i += 2) {
    ctx.fillRect(building.x + i * notch, building.y - 6, notch, 8);
  }

  if (building === state.selectedBuilding) {
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3 / camera.zoom;
    ctx.strokeRect(building.x - 2, building.y - 2, building.size + 4, building.size + 4);
  }

  drawBuildingHealth(building);
}

export function drawCamp(building: Building): void {
  ctx.fillStyle = "#3f1d1d";
  ctx.fillRect(building.x, building.y, building.size, building.size);

  ctx.fillStyle = "#7f1d1d";
  ctx.fillRect(building.x + 10, building.y + 10, building.size - 20, building.size - 20);

  // Banderas en las esquinas
  ctx.fillStyle = "#ef4444";
  const flag = 12;
  ctx.fillRect(building.x - 4, building.y - 16, flag, 16);
  ctx.fillRect(building.x + building.size - 8, building.y - 16, flag, 16);
  ctx.fillRect(building.x - 4, building.y + building.size, flag, 16);
  ctx.fillRect(building.x + building.size - 8, building.y + building.size, flag, 16);

  drawBuildingHealth(building);
}

export function drawBuildingHealth(building: Building): void {
  if (building.hp >= building.maxHp) return;

  const x = building.x;
  const hasQueue = Array.isArray(building.queue) && building.queue.length > 0;
  const y = building.y - (hasQueue || building.type === "depot" || building.type === "camp" || building.type === "tower" ? 26 : 10);

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(x, y, building.size, 6);
  ctx.fillStyle = building.team === TEAM_ENEMY ? "#ef4444" : "#22c55e";
  ctx.fillRect(x, y, building.size * (building.hp / building.maxHp), 6);
}

export function drawBuildGhost() {
  if (!buildMode.active) return;

  const size = BUILD_SPECS[buildMode.type].size;

  ctx.fillStyle = buildMode.valid ? "rgba(143, 206, 107, 0.3)" : "rgba(239, 68, 68, 0.3)";
  ctx.fillRect(buildMode.x, buildMode.y, size, size);

  ctx.strokeStyle = buildMode.valid ? "#8fce6b" : "#ef4444";
  ctx.lineWidth = 2 / camera.zoom;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(buildMode.x, buildMode.y, size, size);
  ctx.setLineDash([]);
}

export function drawEffects() {
  for (const effect of effects) {
    const t = effect.age / EFFECT_DURATION;            // 0 al empezar, 1 al desaparecer
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = effect.color || "#fbbf24";
    ctx.lineWidth = 2 / camera.zoom;

    if (effect.kind === "bolt") {
      // Proyectil del arquero o de la torre.
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 6 + t * 26, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}

export function drawFog() {
  // Zonas nunca exploradas: negro.
  ctx.fillStyle = "#03070b";
  for (let row = 0; row < FOG_ROWS; row++) {
    for (let col = 0; col < FOG_COLS; col++) {
      if (fog.explored[fogIndex(col, row)]) continue;
      ctx.fillRect(col * FOG_TILE, row * FOG_TILE, FOG_TILE, FOG_TILE);
    }
  }

  // Zonas exploradas pero fuera de la visión actual: penumbra.
  ctx.fillStyle = "rgba(3, 7, 11, 0.55)";
  for (let row = 0; row < FOG_ROWS; row++) {
    for (let col = 0; col < FOG_COLS; col++) {
      const index = fogIndex(col, row);
      if (!fog.explored[index] || fog.visible[index]) continue;
      ctx.fillRect(col * FOG_TILE, row * FOG_TILE, FOG_TILE, FOG_TILE);
    }
  }
}

export function drawUnits() {
  for (const unit of units) {
    if (unit.team === TEAM_ENEMY && !isVisibleAt(unit.x + unit.size / 2, unit.y + unit.size / 2)) {
      continue;
    }
    if (unit.team === TEAM_ENEMY) {
      ctx.fillStyle = "#ef4444";
    } else {
      ctx.fillStyle = unit.selected ? "#fbbf24" : unit.color || "#3b82f6";
    }
    ctx.fillRect(unit.x, unit.y, unit.size, unit.size);

    if (unit.hitFlash > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.fillRect(unit.x, unit.y, unit.size, unit.size);
    }

    if (unit.type === "archer" && unit.team === TEAM_PLAYER) {
      // Arco para distinguir al arquero del soldado.
      ctx.strokeStyle = "rgba(224, 242, 254, 0.9)";
      ctx.lineWidth = 1.5 / camera.zoom;
      ctx.beginPath();
      ctx.arc(unit.x + unit.size - 8, unit.y + unit.size / 2, 8, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }

    if (unit.selected) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2 / camera.zoom;
      ctx.strokeRect(unit.x, unit.y, unit.size, unit.size);
    }

    // Vida: siempre en enemigos; en el jugador solo si está herido.
    if (unit.team === TEAM_ENEMY || unit.hp < unit.maxHp) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(unit.x, unit.y - 10, unit.size, 5);
      ctx.fillStyle = unit.team === TEAM_ENEMY ? "#ef4444" : "#22c55e";
      ctx.fillRect(unit.x, unit.y - 10, unit.size * (unit.hp / unit.maxHp), 5);
    }

    // Madera que lleva encima
    if (unit.carrying > 0) {
      ctx.fillStyle = "#a97c50";
      ctx.fillRect(unit.x + unit.size - 12, unit.y + unit.size - 10, 10, 8);
    }

    if (unit.gathering) {
      // Arco que se balancea como un hacha mientras trabaja
      const swing = Math.sin(state.elapsed * 10) * 0.8;
      ctx.strokeStyle = "#8fce6b";
      ctx.lineWidth = 2 / camera.zoom;
      ctx.beginPath();
      ctx.arc(unit.x + unit.size / 2, unit.y - 6, 6, -Math.PI / 2 + swing, Math.PI / 2 + swing);
      ctx.stroke();
    }
  }
}

export function drawVictory() {
  if (!gameState.victory) return;

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 52px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("¡Victoria!", canvas.width / 2, canvas.height / 2);

  ctx.fillStyle = "#e8e8e8";
  ctx.font = "16px system-ui";
  ctx.fillText("Has destruido el campamento enemigo", canvas.width / 2, canvas.height / 2 + 36);
  ctx.textAlign = "left";
}

export function drawDefeat() {
  if (!gameState.defeat || gameState.victory) return;

  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f87171";
  ctx.font = "bold 52px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Derrota", canvas.width / 2, canvas.height / 2);

  ctx.fillStyle = "#e8e8e8";
  ctx.font = "16px system-ui";
  ctx.fillText("Te has quedado sin unidades y sin edificios", canvas.width / 2, canvas.height / 2 + 36);
  ctx.fillText("Pulsa R para reiniciar", canvas.width / 2, canvas.height / 2 + 62);
  ctx.textAlign = "left";
}

export function render() {
  if (gameState.scene === "menu") {
    drawMenu();
    return;
  }

  // Borrar y pintar el fondo (en coordenadas de pantalla)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#24382a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Mundo: la cámara se aplica con una transformación. Todo lo que se dibuje
  // a partir de aquí usa coordenadas del mundo, sin restar la cámara a mano.
  ctx.setTransform(
    camera.zoom, 0,
    0, camera.zoom,
    -camera.x * camera.zoom, -camera.y * camera.zoom
  );

  drawGrid();
  drawTree();
  drawBuildings();
  drawEffects();
  drawUnits();
  drawFog();
  drawBuildGhost();

  // Interfaz: de vuelta a coordenadas de pantalla
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawSelectionBox();
  drawHud();
  drawMinimap();
  drawWaveInfo();
  drawToolbar();
  drawToast();
  drawVictory();
  drawDefeat();
  drawPause();
}
