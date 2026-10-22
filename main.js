// 1. Canvas y pincel
const canvas = document.getElementById("game");   // Obtener el elemento canvas del DOM
const ctx = canvas.getContext("2d");              // Obtener el contexto 2D para dibujar en el canvas  

// 2. Configuración del mundo
const camera = { x: 200, y: 150 };                // Posición de la cámara en el mundo
const TILE_SIZE = 100;                            // Tamaño de cada celda de la cuadrícula en píxeles      
const world = { width: 1600, height: 1200 };      // Tamaño del mundo en píxeles

const units = [                                   // Unidades en el mundo  
  { x: 600, y: 400, size: 40, selected: false },  // Unidad 1
  { x: 660, y: 400, size: 40, selected: false },  // Unidad 2
  { x: 720, y: 400, size: 40, selected: false },  // Unidad 3
  { x: 600, y: 460, size: 40, selected: false },  // Unidad 4
  { x: 660, y: 460, size: 40, selected: false },  // Unidad 5
  { x: 720, y: 460, size: 40, selected: false },  // Unidad 6
];

const tree = { x: 900, y: 500, size: 60 };        // Árbol en el mundo
const CAMERA_SPEED = 400;                         // píxeles por segundo
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
});

canvas.addEventListener("click", (event) => {
  // 1. Posición del clic dentro del canvas
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  // 2. Convertir a coordenadas del mundo
  const worldX = mouseX + camera.x;
  const worldY = mouseY + camera.y;

  // 3. Deseleccionar todas
  for (const unit of units) {
    unit.selected = false;
  }

  // 4. Seleccionar la unidad bajo el cursor
  for (const unit of units) {
    const inside =
      worldX >= unit.x &&
      worldX <= unit.x + unit.size &&
      worldY >= unit.y &&
      worldY <= unit.y + unit.size;

    if (inside) {
      unit.selected = true;
      break;
    }
  }
});


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

  // Unidades
  for (const unit of units) {
    ctx.fillStyle = unit.selected ? "#fbbf24" : "#3b82f6";
    ctx.fillRect(unit.x - camera.x, unit.y - camera.y, unit.size, unit.size);
    if (unit.selected) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(unit.x - camera.x, unit.y - camera.y, unit.size, unit.size);
    }
  }

  // Árbol
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(tree.x - camera.x, tree.y - camera.y, tree.size, tree.size);

  
  // Interfaz
  let selectedCount = 0;
  for (const unit of units) {
    if (unit.selected) {
      selectedCount++;
    }
  }

  ctx.fillStyle = "#e8e8e8";
  ctx.font = "16px system-ui";
  ctx.fillText(
    `Cámara: ${Math.round(camera.x)}, ${Math.round(camera.y)} · Seleccionadas: ${selectedCount}`,
    16,
    24
  );

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