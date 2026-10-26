// Sonido sintetizado con WebAudio.
import { state, canvas, ctx, audio } from "../core/state";
import { showToast } from "../core/feedback";
import type { SoundSpec } from "../core/types";

export function getAudioContext(): AudioContext | null {
  if (!audio.enabled) return null;
  if (audio.context) return audio.context;

  const Ctor =
    typeof window !== "undefined"
      ? (window as any).AudioContext || (window as any).webkitAudioContext
      : null;
  if (!Ctor) return null;

  try {
    audio.context = new Ctor();
  } catch (error) {
    return null;
  }
  return audio.context;
}

export function playSound(kind: string): void {
  if (!audio.enabled) return;

  const context = getAudioContext();
  if (!context) return;

  if (context.state === "suspended" && typeof context.resume === "function") {
    context.resume();
  }

  const presets: Record<string, SoundSpec> = {
    hit: { frequency: 220, duration: 0.08, type: "square", volume: 0.03 },
    shoot: { frequency: 620, duration: 0.08, type: "triangle", volume: 0.025 },
    death: { frequency: 110, duration: 0.2, type: "sawtooth", volume: 0.04 },
    build: { frequency: 440, duration: 0.2, type: "triangle", volume: 0.04 },
    wave: { frequency: 90, duration: 0.45, type: "sawtooth", volume: 0.05 },
    victory: { frequency: 660, duration: 0.6, type: "sine", volume: 0.06 },
    defeat: { frequency: 80, duration: 0.7, type: "sine", volume: 0.06 },
  };

  const preset = presets[kind] || presets.hit;
  const now = context.currentTime;

  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = preset.type;
    oscillator.frequency.value = preset.frequency;
    gain.gain.setValueAtTime(preset.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + preset.duration);
  } catch (error) {
    // Si el navegador bloquea el audio, el juego sigue igual.
  }
}

export function toggleSound(): void {
  audio.enabled = !audio.enabled;
  if (audio.enabled) playSound("build");
  showToast(audio.enabled ? "Sonido activado" : "Sonido silenciado");
}
