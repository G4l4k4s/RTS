// Utilidades geométricas puras, sin estado ni DOM.

// ¿Se solapan dos rectángulos { x, y, w, h }?
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ¿El punto (x, y) está dentro del rectángulo?
export function pointInRect(x, y, rect) {
  return x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h;
}

// ¿El segmento que va de (x1,y1) a (x2,y2) atraviesa el rectángulo?
// Se comprueba contra el rectángulo un poco encogido: así la ruta puede pasar
// justo por el borde (las esquinas) pero no cruzar por dentro.
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const inner = {
    x: rect.x + 0.01,
    y: rect.y + 0.01,
    w: rect.w - 0.02,
    h: rect.h - 0.02,
  };

  let t0 = 0;                                      // entrada del segmento
  let t1 = 1;                                      // salida del segmento
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Cada lado del rectángulo recorta el trozo de segmento que queda dentro.
  const sides = [
    [-dx, x1 - inner.x],
    [dx, inner.x + inner.w - x1],
    [-dy, y1 - inner.y],
    [dy, inner.y + inner.h - y1],
  ];

  for (const [p, q] of sides) {
    if (p === 0) {
      if (q < 0) return false;                     // paralelo y fuera
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }

  return true;
}

// Rectángulo del obstáculo "engordado": si el centro de la unidad pasa por
// fuera de él, su cuerpo no roza el obstáculo.
export function paddedRect(obstacle, unit) {
  const pad = unit.size / 2 + 2;
  return {
    x: obstacle.x - pad,
    y: obstacle.y - pad,
    w: obstacle.size + pad * 2,
    h: obstacle.size + pad * 2,
  };
}

// Rectángulo que ocupa una unidad en el mundo.
export function unitRect(unit) {
  return { x: unit.x, y: unit.y, w: unit.size, h: unit.size };
}
