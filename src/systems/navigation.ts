// Rutas, colisiones y separación entre unidades.
import { state, canvas, ctx, units, obstacles } from "../core/state";
import {
  MIN_ZOOM, MAX_ZOOM, TILE_SIZE, world, FOG_TILE, FOG_COLS, FOG_ROWS, VISION_UNIT, VISION_BUILDING, MINIMAP_WIDTH, MINIMAP_HEIGHT, CAMERA_SPEED, EDGE_SCROLL_MARGIN, UNIT_SPEED, UNIT_SIZE, EFFECT_DURATION, GATHER_RATE, CARRY_CAPACITY, WOOD_PER_TREE, HUD_HEIGHT, BARRACKS_COST, BARRACKS_SIZE, BARRACKS_HP, TOWER_COST, TOWER_SIZE, TOWER_HP, TOWER_RANGE, TOWER_DAMAGE, TOWER_COOLDOWN, UNIT_COST, TRAIN_TIME, MAX_QUEUE, MAX_UNITS, BUILD_SNAP, TEAM_PLAYER, TEAM_ENEMY, UNIT_MAX_HP, UNIT_DAMAGE, UNIT_ATTACK_RANGE, UNIT_ATTACK_COOLDOWN, ENEMY_MAX_HP, ENEMY_DAMAGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN, ENEMY_AGGRO_RANGE, CAMP_HP, CAMP_SIZE, CAMP_SPAWN_INTERVAL, CAMP_MAX_GUARDS, CAMP_GUARD_RADIUS, WAVE_FIRST_DELAY, WAVE_INTERVAL, WAVE_MAX_LIVE, AUTOSAVE_KEY, SAVE_KEY, DIFFICULTIES, START_POSITIONS, UNIT_STATS, BUILD_SPECS, OBSTACLE_MARGIN
} from "../core/constants";
import { rectsOverlap, segmentHitsRect, paddedRect } from "../core/math";
import type { Point, Rect, SizeRect, Unit } from "../core/types";

// ¿Puede una unidad estar en esta posición? (dentro del mundo y fuera de los obstáculos)
export function canStand(unit: { size: number }, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x + unit.size > world.width || y + unit.size > world.height) {
    return false;
  }
  const box = { x, y, w: unit.size, h: unit.size };
  for (const obstacle of obstacles) {
    const obstacleRect = { x: obstacle.x, y: obstacle.y, w: obstacle.size, h: obstacle.size };
    if (rectsOverlap(box, obstacleRect)) {
      return false;
    }
  }
  return true;
}

// Coloca el destino dentro del mundo y fuera de los obstáculos, para que una
// unidad nunca reciba la orden de meterse en un sitio donde no cabe.
export function clampDestination(unit: SizeRect, x: number, y: number): Point {
  const maxX = world.width - unit.size;
  const maxY = world.height - unit.size;
  let tx = Math.max(0, Math.min(x, maxX));
  let ty = Math.max(0, Math.min(y, maxY));

  for (const obstacle of obstacles) {
    const obstacleRect = { x: obstacle.x, y: obstacle.y, w: obstacle.size, h: obstacle.size };
    const unitBox = { x: tx, y: ty, w: unit.size, h: unit.size };
    if (!rectsOverlap(unitBox, obstacleRect)) continue;

    // Empujar el destino hacia el lado del obstáculo que esté más cerca.
    const outLeft = unitBox.x + unitBox.w - obstacleRect.x;      // distancia para salir por la izquierda
    const outRight = obstacleRect.x + obstacleRect.w - unitBox.x;  // ... por la derecha
    const outTop = unitBox.y + unitBox.h - obstacleRect.y;         // ... por arriba
    const outBottom = obstacleRect.y + obstacleRect.h - unitBox.y; // ... por abajo
    const smallest = Math.min(outLeft, outRight, outTop, outBottom);

    if (smallest === outLeft) tx = obstacleRect.x - unit.size - OBSTACLE_MARGIN;
    else if (smallest === outRight) tx = obstacleRect.x + obstacleRect.w + OBSTACLE_MARGIN;
    else if (smallest === outTop) ty = obstacleRect.y - unit.size - OBSTACLE_MARGIN;
    else ty = obstacleRect.y + obstacleRect.h + OBSTACLE_MARGIN;

    tx = Math.max(0, Math.min(tx, maxX));
    ty = Math.max(0, Math.min(ty, maxY));
  }

  return { x: tx, y: ty };
}

// Ruta de una unidad hasta su destino. Se construye un grafo con la salida, el
// destino y las esquinas de todos los obstáculos: si dos puntos se "ven" (el
// segmento no cruza nada) se conectan, y se busca el camino más corto.
export function buildRoute(unit: SizeRect, target: Point): Point[] {
  const start: Point = { x: unit.x + unit.size / 2, y: unit.y + unit.size / 2 };
  const end: Point = { x: target.x + unit.size / 2, y: target.y + unit.size / 2 };

  // Rectángulos engordados de todos los obstáculos.
  const blocked: Rect[] = obstacles.map((obstacle) => paddedRect(obstacle, unit));

  // Si no hay nada en medio, ir en línea recta.
  const crosses = blocked.some((rect) => segmentHitsRect(start.x, start.y, end.x, end.y, rect));
  if (!crosses) return [target];

  // Nodos: 0 = salida, 1 = destino, el resto = esquinas de los obstáculos.
  const nodes: Point[] = [start, end];
  for (const rect of blocked) {
    nodes.push(
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h }
    );
  }

  // Aristas entre pares de nodos que se ven sin cruzar ningún obstáculo.
  const count = nodes.length;
  const edges: { to: number; cost: number }[][] = nodes.map(() => []);

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      let visible = true;
      for (const rect of blocked) {
        if (segmentHitsRect(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y, rect)) {
          visible = false;
          break;
        }
      }
      if (!visible) continue;

      const cost = Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y);
      edges[i].push({ to: j, cost });
      edges[j].push({ to: i, cost });
    }
  }

  // Dijkstra: distancia mínima desde la salida (0) hasta cada nodo.
  const distance: number[] = nodes.map(() => Infinity);
  const previous: number[] = nodes.map(() => -1);
  const visited: boolean[] = nodes.map(() => false);
  distance[0] = 0;

  for (let step = 0; step < count; step++) {
    let current = -1;
    for (let i = 0; i < count; i++) {
      if (!visited[i] && distance[i] < Infinity && (current === -1 || distance[i] < distance[current])) {
        current = i;
      }
    }
    if (current === -1) break;

    visited[current] = true;
    for (const edge of edges[current]) {
      if (distance[current] + edge.cost < distance[edge.to]) {
        distance[edge.to] = distance[current] + edge.cost;
        previous[edge.to] = current;
      }
    }
  }

  // Sin ruta: que vaya en línea recta y se acerque todo lo que pueda.
  if (distance[1] === Infinity) return [target];

  // Reconstruir el camino desde el destino hacia atrás.
  const route: Point[] = [];
  let node = 1;
  while (node !== -1 && node !== 0) {
    route.unshift(nodes[node]);
    node = previous[node];
  }

  // Las esquinas son para el centro de la unidad; se pasan a su esquina
  // superior izquierda. El destino se deja tal cual.
  const waypoints = route.map((point) =>
    point === end
      ? target
      : clampDestination(unit, point.x - unit.size / 2, point.y - unit.size / 2)
  );

  // Quitar esquinas intermedias que no hacen falta: si desde el punto actual
  // se ve el siguiente, no hay que pasar por la de en medio.
  return smoothRoute(unit, waypoints, blocked);
}

// Suaviza una ruta saltándose paradas que se pueden ver en línea recta.
export function smoothRoute(unit: SizeRect, path: Point[], blocked: Rect[]): Point[] {
  const result: Point[] = [];
  let fromX = unit.x + unit.size / 2;
  let fromY = unit.y + unit.size / 2;

  for (let i = 0; i < path.length; i++) {
    const next = path[i + 1];

    if (next) {
      const nextX = next.x + unit.size / 2;
      const nextY = next.y + unit.size / 2;

      let clear = true;
      for (const rect of blocked) {
        if (segmentHitsRect(fromX, fromY, nextX, nextY, rect)) {
          clear = false;
          break;
        }
      }

      if (clear) continue;                 // esta parada sobra
    }

    result.push(path[i]);
    fromX = path[i].x + unit.size / 2;
    fromY = path[i].y + unit.size / 2;
  }

  return result;
}

// Evita que las unidades se pisen. Las quietas se separan del todo; al que
// camina se le empuja un poco para que esquive a las demás, y si se cruzan
// dos que caminan se apartan suavemente.
export function separateUnits(): void {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i];
        const b = units[j];
        const aMoving = Boolean(a.dest);
        const bMoving = Boolean(b.dest);

        if (!aMoving && !bMoving) {
          separatePair(a, b, 1);
        } else if (aMoving && !bMoving) {
          pushMover(a, b);
        } else if (!aMoving && bMoving) {
          pushMover(b, a);
        } else {
          separatePair(a, b, 0.4);
        }
      }
    }
  }
}

export function separatePair(a: Unit, b: Unit, strength: number): void {
  const overlapX = Math.min(a.x + a.size, b.x + b.size) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.size, b.y + b.size) - Math.max(a.y, b.y);
  if (overlapX <= 0 || overlapY <= 0) return;

  // Separarlas por el eje en el que se solapan menos.
  // Si ambas están quietas se separan del todo; si alguna camina, el empuje se
  // limita para que nunca sea mayor que su avance (2,67 px por frame a 60 Hz):
  // si no, se quedarían oscilando sin llegar.
  const limit = strength >= 1 ? Infinity : 0.8;
  if (overlapX < overlapY) {
    const push = Math.min((overlapX / 2 + 0.5) * strength, limit);
    const direction = a.x < b.x ? 1 : -1;
    pushApart(a, -push * direction, 0);
    pushApart(b, push * direction, 0);
  } else {
    const push = Math.min((overlapY / 2 + 0.5) * strength, limit);
    const direction = a.y < b.y ? 1 : -1;
    pushApart(a, 0, -push * direction);
    pushApart(b, 0, push * direction);
  }
}

// Aparta al que camina cuando se topa con uno quieto, sin mover al quieto.
// Se aparta en perpendicular a su movimiento: empujarlo hacia atrás lo dejaría
// oscilando contra el mismo obstáculo.
export function pushMover(mover: Unit, idle: Unit): void {
  const overlapX = Math.min(mover.x + mover.size, idle.x + idle.size) - Math.max(mover.x, idle.x);
  const overlapY = Math.min(mover.y + mover.size, idle.y + idle.size) - Math.max(mover.y, idle.y);
  if (overlapX <= 0 || overlapY <= 0) return;

  const step = 0.8;                          // roce pequeño, no puede frenar a nadie
  const dx = mover.dest ? mover.dest.x - mover.x : 0;
  const dy = mover.dest ? mover.dest.y - mover.y : 0;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Va en horizontal: se aparta en vertical.
    const direction = mover.y < idle.y ? -1 : 1;
    pushApart(mover, 0, direction * Math.min(overlapY + 0.5, step));
  } else {
    // Va en vertical: se aparta en horizontal.
    const direction = mover.x < idle.x ? -1 : 1;
    pushApart(mover, direction * Math.min(overlapX + 0.5, step), 0);
  }
}

// Mueve una unidad solo si la posición de destino es válida.
export function pushApart(unit: Unit, dx: number, dy: number): void {
  if (canStand(unit, unit.x + dx, unit.y + dy)) {
    unit.x += dx;
    unit.y += dy;
  }
}
