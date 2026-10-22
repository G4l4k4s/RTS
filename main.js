// 1. Buscar el canvas por su id
const canvas = document.getElementById("game");

// 2. Obtener el pincel 2D
const ctx = canvas.getContext("2d");

// // 3. Elegir el color del pincel
// ctx.fillStyle = "#3b82f6"; // Azul
// // 4. Dibujar un rectángulo relleno
// ctx.fillRect(380, 280, 40, 40);

// // 5. Escribir un mensaje en la consola
// console.log("Juego iniciado");

let x = 380;
let y = 280;
let vy = -300; // velocidad vertical
let vx = -300; // píxeles por segundo
let lastTime = performance.now();

function update(dt) {
  // Mover el cuadrado
  x += vx * dt;
  y += vy * dt;

  // Rebote en el borde derecho
  if (x + 40 >= canvas.width) {
    x = canvas.width - 40;
    vx = -300;
  }

  // Rebote en el borde izquierdo
  if (x <= 0) {
    x = 0;
    vx = 300;
  }

  // Rebote en el borde inferior
  if (y + 40 >= canvas.height) {
    y = canvas.height - 40;
    vy = -300;
  }

  // Rebote en el borde superior
  if (y <= 0) {
    y = 0;
    vy = 300;
  }
}

function render() {
  // Borrar el frame anterior
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dibujar el cuadrado en su nueva posición
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(x, y, 40, 40);
}

function gameLoop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
console.log("Juego iniciado");