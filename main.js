// 1. Canvas y pincel
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// 2. Configuración del mundo
const world = { width: 1600, height: 1200 };
const camera = { x: 200, y: 150 };

// 3. Tiempo
let lastTime = performance.now();

// 4. Actualizar el estado
function update(dt) {
  // Aquí moveremos la cámara más adelante
}

// 5. Dibujar
function render() {
  // Borrar el frame anterior
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fondo del mundo
  ctx.fillStyle = "#24382a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// 6. Bucle del juego
function gameLoop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
console.log("Juego iniciado");