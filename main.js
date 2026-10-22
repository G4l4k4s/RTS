// 1. Buscar el canvas por su id
const canvas = document.getElementById("game");

// 2. Obtener el pincel 2D
const ctx = canvas.getContext("2d");

// 3. Elegir el color del pincel
ctx.fillStyle = "#3b82f6"; // Azul
// 4. Dibujar un rectángulo relleno
ctx.fillRect(380, 280, 40, 40);

// 5. Escribir un mensaje en la consola
console.log("Juego iniciado");