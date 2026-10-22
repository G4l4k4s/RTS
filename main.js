// 1. Canvas y pincel
const canvas = document.getElementById("game");  // Obtener el elemento canvas del DOM
const ctx = canvas.getContext("2d");             // Obtener el contexto 2D para dibujar en el canvas

// 2. Configuración del mundo
const world = { width: 1600, height: 1200 };  // Tamaño del mundo en píxeles
const camera = { x: 200, y: 150 };            // Posición de la cámara en el mundo
const TILE_SIZE = 100;                        // Tamaño de cada celda de la cuadrícula en píxeles      
const unit = { x: 600, y: 400, size: 40 };    // Unidad en el mundo
const tree = { x: 900, y: 500, size: 60 };    // Árbol en el mundo
const CAMERA_SPEED = 400;                     // píxeles por segundo
const keys = {};



// 2.1. Manejo de eventos de teclado
// Evitar el comportamiento predeterminado de las teclas de flecha para que no se desplace la página
window.addEventListener("keydown", (event) => {
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
  }
  keys[event.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (event) => {           // Cuando se suelta una tecla, marcarla como no presionada
  keys[event.key.toLowerCase()] = false;                // Marcar la tecla como no presionada
});                                                     // 2.2. Manejo de eventos de redimensionamiento


// 3. Tiempo
let lastTime = performance.now();             // Última vez que se actualizó el juego

// 4. Actualizar el estado
function update(dt) {
  if (keys["w"] || keys["arrowup"]) camera.y -= CAMERA_SPEED * dt;     // Mover la cámara hacia arriba  
  if (keys["s"] || keys["arrowdown"]) camera.y += CAMERA_SPEED * dt;   // Mover la cámara hacia abajo
  if (keys["a"] || keys["arrowleft"]) camera.x -= CAMERA_SPEED * dt;   // Mover la cámara hacia la izquierda
  if (keys["d"] || keys["arrowright"]) camera.x += CAMERA_SPEED * dt;  // Mover la cámara hacia la derecha

  // Límites del mundo
  const maxX = world.width - canvas.width;                             // Limite derecho del mundo
  const maxY = world.height - canvas.height;                           // Limite inferior del mundo  

  camera.x = Math.max(0, Math.min(camera.x, maxX));                    // Limitar la posición de la cámara en el eje X
  camera.y = Math.max(0, Math.min(camera.y, maxY));                    // Limitar la posición de la cámara en el eje Y

}

// 5. Dibujar
function render() {

  // Borrar el frame anterior
  ctx.clearRect(0, 0, canvas.width, canvas.height);   // Limpiar el canvas antes de dibujar el siguiente frame

  // Fondo del mundo
  ctx.fillStyle = "#24382a";                       // Color de fondo del mundo
  ctx.fillRect(0, 0, canvas.width, canvas.height);   // Dibujar el fondo del mundo en el canvas 

  // Cuadrícula del mundo
  ctx.strokeStyle = "#3a5a42";                     // Color de las líneas de la cuadrícula
  ctx.lineWidth = 1;                                 // Ancho de las líneas de la cuadrícula

  for (let x = 0; x <= world.width; x += TILE_SIZE) {
    const screenX = x - camera.x;
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= world.height; y += TILE_SIZE) {
    const screenY = y - camera.y;
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(canvas.width, screenY);
    ctx.stroke();
  }

  // Información de la cámara
  ctx.fillStyle = "#e8e8e8";
  ctx.font = "16px system-ui";
  ctx.fillText(`Cámara: ${Math.round(camera.x)}, ${Math.round(camera.y)}`, 16, 24);  // Mostrar la posición de la cámara en la esquina superior izquierda


  // Unidad
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(unit.x - camera.x, unit.y - camera.y, unit.size, unit.size);

  // Árbol
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(tree.x - camera.x, tree.y - camera.y, tree.size, tree.size);



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