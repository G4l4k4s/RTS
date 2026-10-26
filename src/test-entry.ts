// Entrada exclusiva para las pruebas: arranca el juego y expone su estado.
import "./main";
import { gameLoop } from "./main";
import {
  state, canvas, ctx, camera, units, tree, stockpile, buildings, buildMode,
  obstacles, camp, depot, gameState, waveState, fog, toast, audio, keys, drag,
  effects, controlGroups, mouse,
} from "./core/state";
import {
  DIFFICULTIES, AUTOSAVE_KEY, world,
} from "./core/constants";
import { screenToWorld, clampCamera } from "./core/view";
import { menuButtons } from "./core/layout";
import { createUnit } from "./entities/unit";
import { updateFog, isVisibleAt, isExploredAt } from "./systems/fog";
import { clearSelection, selectedUnits } from "./systems/selection";
import { issueMoveOrder } from "./systems/orders";
import { canStand } from "./systems/navigation";
import { saveGame, loadGame, startNewGame, hasAutosave, togglePause, goToMenu } from "./systems/session";
import { update } from "./game/update";
import { render } from "./render/render";
import { minimapRect, minimapClick } from "./render/minimap";
import { handleMenuClick } from "./ui/menu";

(globalThis as any).__game = {
  units, camera, drag, effects, update, render, issueMoveOrder, clearSelection, selectedUnits,
  keys, gameLoop, tree, world, stockpile, obstacles, mouse, screenToWorld, clampCamera,
  buildings, buildMode, getSelectedBuilding: () => state.selectedBuilding, camp, gameState,
  waveState, fog, updateFog, isVisibleAt, isExploredAt, minimapRect, minimapClick,
  audio, createUnit, toast, saveGame, loadGame, canStand, startNewGame, menuButtons,
  handleMenuClick, togglePause, goToMenu, hasAutosave, DIFFICULTIES, AUTOSAVE_KEY,
};
