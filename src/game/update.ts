// Bucle de simulación: cámara, combate, movimiento, economía y efectos.
import { state, canvas, ctx, camera, units, gameState, keys, mouse } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { clampCamera } from "../core/view";
import { updateCombat } from "../systems/combat";
import { canStand, separateUnits } from "../systems/navigation";
import { handleArrival } from "../systems/economy";
import { updateGathering } from "../systems/economy";
import { updateCamp, updateWaves, updateDefeat } from "../systems/waves";
import { updateBuildings, updateTowers } from "../systems/buildings";
import { updateFog } from "../systems/fog";
import { updateEffects } from "../core/feedback";



// Mueve una unidad hacia su destino. La ruta ya esquiva los obstáculos, pero si
// algo la bloquea de todos modos, intenta deslizarse por uno de los dos ejes.
export function updateUnit(unit, dt) {
  if (!unit.dest) return;

  const dx = unit.dest.x - unit.x;
  const dy = unit.dest.y - unit.y;
  const distance = Math.hypot(dx, dy);
  const step = (unit.speed || UNIT_SPEED) * dt;

  // Ya llegó (o el paso de este frame la deja más cerca que el propio destino).
  if (distance <= step) {
    unit.x = unit.dest.x;
    unit.y = unit.dest.y;
    unit.stuckTime = 0;

    // Puede quedar otra parada en la ruta (la esquina del obstáculo).
    unit.path.shift();
    unit.dest = unit.path.length > 0 ? unit.path[0] : null;

    // Al llegar al final, la tarea decide qué hacer (talar o entregar).
    if (!unit.dest) {
      handleArrival(unit);
    }
    return;
  }

  const moveX = (dx / distance) * step;
  const moveY = (dy / distance) * step;

  const startX = unit.x;
  const startY = unit.y;

  if (canStand(unit, unit.x + moveX, unit.y + moveY)) {
    unit.x += moveX;
    unit.y += moveY;
  } else if (moveX !== 0 && canStand(unit, unit.x + moveX, unit.y)) {
    unit.x += moveX;                        // deslizarse en horizontal
  } else if (moveY !== 0 && canStand(unit, unit.x, unit.y + moveY)) {
    unit.y += moveY;                        // deslizarse en vertical
  }

  // Contar como avance solo si de verdad se movió: un deslizamiento de 0 px
  // no debe reiniciar el temporizador de bloqueo.
  if (Math.hypot(unit.x - startX, unit.y - startY) > 0.0001) {
    unit.stuckTime = 0;
  } else {
    // Totalmente bloqueada: si sigue así mucho tiempo, abandonar la orden.
    unit.stuckTime = (unit.stuckTime || 0) + dt;
    if (unit.stuckTime > 1.5) {
      unit.dest = null;
      unit.path = [];
      unit.stuckTime = 0;
    }
  }
}

// Actualiza toda la simulación de un frame.
export function update(dt: number) {
  if (gameState.scene !== "playing" || gameState.paused) return;

  state.elapsed += dt;

  // A velocidad constante en pantalla: con zoom alejado la cámara recorre más
  // mundo por segundo, y al acercarse menos, para que se sienta igual.
  const cameraStep = (CAMERA_SPEED / camera.zoom) * dt;

  if (keys["w"] || keys["arrowup"]) camera.y -= cameraStep;
  if (keys["s"] || keys["arrowdown"]) camera.y += cameraStep;
  if (keys["a"] || keys["arrowleft"]) camera.x -= cameraStep;
  if (keys["d"] || keys["arrowright"]) camera.x += cameraStep;

  if (mouse.inside) {
    const viewBottom = canvas.height - HUD_HEIGHT;

    if (mouse.screenX < EDGE_SCROLL_MARGIN) camera.x -= cameraStep;
    if (mouse.screenX > canvas.width - EDGE_SCROLL_MARGIN) camera.x += cameraStep;
    if (mouse.screenY < EDGE_SCROLL_MARGIN) camera.y -= cameraStep;
    if (mouse.screenY > viewBottom - EDGE_SCROLL_MARGIN && mouse.screenY < viewBottom) {
      camera.y += cameraStep;
    }
  }

  clampCamera();

  for (const unit of units.slice()) {
    updateCombat(unit, dt);
  }

  for (const unit of units) {
    updateUnit(unit, dt);
  }

  separateUnits();

  updateCamp(dt);
  updateWaves(dt);
  updateDefeat();
  updateBuildings(dt);
  updateTowers(dt);

  state.fogTimer -= dt;
  if (state.fogTimer <= 0) {
    state.fogTimer = 0.15;
    updateFog();
  }

  updateGathering(dt);
  updateEffects(dt);
}
