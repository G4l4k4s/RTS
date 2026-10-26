// Tipos compartidos por el estado y los sistemas del juego.
// Son deliberadamente flexibles: el motor guarda datos en objetos planos y
// algunos campos opcionales aparecen según el tipo de entidad.

export type Team = "player" | "enemy";
export type UnitType = "soldier" | "archer";
export type BuildableType = "barracks" | "tower";
export type BuildingType = BuildableType | "depot" | "camp";
export type Difficulty = "easy" | "normal" | "hard";
export type Scene = "menu" | "playing";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SizeRect {
  x: number;
  y: number;
  size: number;
}

export interface UnitStats {
  hp: number;
  damage: number;
  range: number;
  cooldown: number;
  speed: number;
  color: string;
  cost: number;
}

export interface BuildSpec {
  cost: number;
  size: number;
  hp: number;
}

export interface DifficultyConfig {
  label: string;
  wood: number;
  firstWave: number;
  waveInterval: number;
  waveBase: number;
  waveGrowth: number;
  enemyHp: number;
  enemyDamage: number;
}

export interface SoundSpec {
  frequency: number;
  duration: number;
  type: OscillatorType;
  volume: number;
}

export interface AttackTarget {
  x: number;
  y: number;
  size: number;
  team?: Team;
  hp?: number;
  alive?: boolean;
  [key: string]: any;
}

export interface Unit {
  x: number;
  y: number;
  size: number;
  team: Team;
  type: UnitType;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  cooldownMax: number;
  cooldown: number;
  speed: number;
  color: string;
  attackTarget: AttackTarget | null;
  repathTimer: number;
  wave: boolean;
  hitFlash: number;
  selected: boolean;
  dest: Point | null;
  path: Point[];
  gathering: boolean;
  gatherOrder: any;
  task: any;
  carrying: number;
  stuckTime: number;
  [key: string]: any;
}

export interface Building extends SizeRect {
  team: Team;
  type: BuildingType;
  hp: number;
  maxHp: number;
  queue?: UnitType[];
  progress?: number;
  cooldown?: number;
  spawnTimer?: number;
  alive?: boolean;
  [key: string]: any;
}

export interface Tree extends SizeRect {
  wood: number;
  maxWood: number;
  depleted: boolean;
}

export interface Camp extends Building {
  type: "camp";
  alive: boolean;
  spawnTimer: number;
}

export interface Depot extends Building {
  type: "depot";
}

export interface Effect {
  kind: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  age: number;
  color: string;
  [key: string]: any;
}
