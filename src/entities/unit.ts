// Creación de unidades.
import {
  TEAM_ENEMY, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE,
  ENEMY_ATTACK_COOLDOWN, UNIT_SPEED, UNIT_SIZE, UNIT_STATS
} from "../core/constants";

// Crea una unidad del equipo y tipo indicados.
export function createUnit(x, y, team, type = "soldier") {
  const stats =
    team === TEAM_ENEMY
      ? {
          hp: ENEMY_MAX_HP,
          damage: ENEMY_DAMAGE,
          range: ENEMY_ATTACK_RANGE,
          cooldown: ENEMY_ATTACK_COOLDOWN,
          speed: UNIT_SPEED,
          color: "#ef4444",
        }
      : UNIT_STATS[type] || UNIT_STATS.soldier;

  return {
    x,
    y,
    size: UNIT_SIZE,
    team,
    type: team === TEAM_ENEMY ? "soldier" : type,
    hp: stats.hp,
    maxHp: stats.hp,
    damage: stats.damage,
    range: stats.range,
    cooldownMax: stats.cooldown,
    cooldown: 0,
    speed: stats.speed,
    color: stats.color,
    attackTarget: null,
    repathTimer: 0,
    wave: false,
    hitFlash: 0,
    selected: false,
    dest: null,
    path: [],
    gathering: false,
    gatherOrder: false,
    task: null,
    carrying: 0,
    stuckTime: 0,
  };
}
