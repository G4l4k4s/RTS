// Avisos flotantes y efectos temporales.
import { state, canvas, ctx, units, effects, toast } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";

export function showToast(text) {
  toast.text = text;
  toast.time = 2.5;
}

// Actualiza los destellos de daño, los efectos y el aviso flotante.
export function updateEffects(dt: number) {
  for (const unit of units) {
    if (unit.hitFlash > 0) {
      unit.hitFlash = Math.max(0, unit.hitFlash - dt);
    }
  }

  for (const effect of effects) {
    effect.age += dt;
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    if (effects[i].age > EFFECT_DURATION) {
      effects.splice(i, 1);
    }
  }

  if (toast.time > 0) {
    toast.time = Math.max(0, toast.time - dt);
  }
}
