// Constantes y datos de configuración del juego.
// No contienen estado mutable: se pueden importar desde cualquier módulo.

// 2. Configuración del mundo
export const MIN_ZOOM = 0.75; // Cuánto se puede alejar la cámara
export const MAX_ZOOM = 1.6; // Cuánto se puede acercar
export const TILE_SIZE = 100; // Tamaño de cada celda de la cuadrícula
export const world = { width: 1600, height: 1200 }; // Tamaño del mundo en píxeles

// Niebla de guerra y minimapa
export const FOG_TILE = 50; // Tamaño de celda de la niebla
export const FOG_COLS = world.width / FOG_TILE;
export const FOG_ROWS = world.height / FOG_TILE;
export const VISION_UNIT = 220; // Radio que revela una unidad
export const VISION_BUILDING = 260; // Radio que revela un edificio
export const MINIMAP_WIDTH = 160;
export const MINIMAP_HEIGHT = 120;

export const CAMERA_SPEED = 400; // Píxeles por segundo que se mueve la cámara
export const EDGE_SCROLL_MARGIN = 24; // Distancia al borde que activa el scroll
export const UNIT_SPEED = 160; // Píxeles por segundo que camina una unidad
export const UNIT_SIZE = 40; // Lado del cuadrado de cada unidad
export const EFFECT_DURATION = 0.6; // Segundos que dura el círculo que marca el destino

export const GATHER_RATE = 12; // Madera por segundo que extrae cada unidad
export const CARRY_CAPACITY = 10; // Madera que cabe en un viaje
export const WOOD_PER_TREE = 300; // Madera que guarda un árbol
export const HUD_HEIGHT = 64; // Alto de la barra de interfaz

export const BARRACKS_COST = 150; // Madera que cuesta un cuartel
export const BARRACKS_SIZE = 80; // Lado del cuartel
export const BARRACKS_HP = 300; // Vida de un cuartel
export const TOWER_COST = 100; // Madera que cuesta una torre
export const TOWER_SIZE = 60;
export const TOWER_HP = 250;
export const TOWER_RANGE = 150; // Alcance de la torre
export const TOWER_DAMAGE = 10;
export const TOWER_COOLDOWN = 1;
export const UNIT_COST = 50; // Madera que cuesta un soldado
export const TRAIN_TIME = 4; // Segundos que tarda una unidad
export const MAX_QUEUE = 5; // Unidades en cola por cuartel
export const MAX_UNITS = 40; // Tope de unidades del jugador
export const BUILD_SNAP = 20; // Los edificios se colocan en una rejilla de 20 px

// Combate
export const TEAM_PLAYER = "player";
export const TEAM_ENEMY = "enemy";

export const UNIT_MAX_HP = 100; // Vida de un soldado
export const UNIT_DAMAGE = 12; // Daño por golpe
export const UNIT_ATTACK_RANGE = 12; // Hueco entre bordes al atacar
export const UNIT_ATTACK_COOLDOWN = 0.8; // Segundos entre golpes

export const ENEMY_MAX_HP = 80;
export const ENEMY_DAMAGE = 8;
export const ENEMY_ATTACK_RANGE = 12;
export const ENEMY_ATTACK_COOLDOWN = 1.2;
export const ENEMY_AGGRO_RANGE = 320; // Hasta dónde persigue un enemigo

export const CAMP_HP = 400; // Vida del campamento enemigo
export const CAMP_SIZE = 90;
export const CAMP_SPAWN_INTERVAL = 12; // Segundos entre guardias
export const CAMP_MAX_GUARDS = 6;
export const CAMP_GUARD_RADIUS = 300; // Sólo saca guardias si te acercas

export const WAVE_FIRST_DELAY = 60; // Segundos hasta la primera oleada
export const WAVE_INTERVAL = 45; // Segundos entre oleadas
export const WAVE_MAX_LIVE = 24; // Tope de enemigos vivos a la vez

export const AUTOSAVE_KEY = "mi-primer-rts-autosave";
export const SAVE_KEY = "mi-primer-rts-save";

// Presets de dificultad: economía inicial y ritmo de las oleadas.
export const DIFFICULTIES = {
  easy: {
    label: "Fácil",
    wood: 100,
    firstWave: 90,
    waveInterval: 55,
    waveBase: 1,
    waveGrowth: 0.35,
    enemyHp: 0.9,
    enemyDamage: 0.85,
  },
  normal: {
    label: "Normal",
    wood: 0,
    firstWave: 60,
    waveInterval: 45,
    waveBase: 2,
    waveGrowth: 0.5,
    enemyHp: 1,
    enemyDamage: 1,
  },
  hard: {
    label: "Difícil",
    wood: 0,
    firstWave: 45,
    waveInterval: 35,
    waveBase: 3,
    waveGrowth: 0.7,
    enemyHp: 1.15,
    enemyDamage: 1.15,
  },
};

export const START_POSITIONS = [
  [600, 400],
  [660, 400],
  [720, 400],
  [600, 460],
  [660, 460],
  [720, 460],
];

// Tipos de unidad del jugador.
export const UNIT_STATS = {
  soldier: {
    hp: UNIT_MAX_HP,
    damage: UNIT_DAMAGE,
    range: UNIT_ATTACK_RANGE,
    cooldown: UNIT_ATTACK_COOLDOWN,
    speed: UNIT_SPEED,
    color: "#3b82f6",
    cost: UNIT_COST,
  },
  archer: {
    hp: 70,
    damage: 9,
    range: 130,
    cooldown: 1.1,
    speed: 150,
    color: "#38bdf8",
    cost: 60,
  },
};

// Tipos de edificio que se pueden construir.
export const BUILD_SPECS = {
  barracks: { cost: BARRACKS_COST, size: BARRACKS_SIZE, hp: BARRACKS_HP },
  tower: { cost: TOWER_COST, size: TOWER_SIZE, hp: TOWER_HP },
};

// Separación mínima entre una unidad y un obstáculo cuando se recoloca un
// destino. Debe ser mayor que el margen de la ruta (paddedRect) para que el
// destino quede siempre fuera de la zona "engordada".
export const OBSTACLE_MARGIN = 3;
