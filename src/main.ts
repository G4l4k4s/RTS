// Punto de entrada del juego.
import { registerInput } from "./ui/input";
import { update } from "./game/update";
import { render } from "./render/render";

registerInput();

let lastTime = performance.now();

export function gameLoop(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
console.log("Juego iniciado");
