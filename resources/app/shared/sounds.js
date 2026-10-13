"use strict";
const SOUNDS = ["chime", "bell", "ping", "alarm", "soft"];
function playSound(ctx, name, volume) {
  const level = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
  if (!level) return;
  const now = ctx.currentTime;
  const note = (hz, start, length, type = "sine", loud = 1) => {
    const tone = ctx.createOscillator();
    const gain = ctx.createGain();
    tone.type = type;
    tone.frequency.value = hz;
    gain.gain.setValueAtTime(1e-4, now + start);
    gain.gain.exponentialRampToValueAtTime(Math.max(2e-4, 0.4 * level * loud), now + start + 0.015);
    gain.gain.exponentialRampToValueAtTime(1e-4, now + start + length);
    tone.connect(gain).connect(ctx.destination);
    tone.start(now + start);
    tone.stop(now + start + length + 0.05);
  };
  if (name === "chime") {
    note(880, 0, 0.5);
    note(1318.5, 0.18, 0.6);
  } else if (name === "bell") {
    note(784, 0, 1.6);
    note(1568, 0, 1.2, "sine", 0.35);
    note(2352, 0, 0.8, "sine", 0.15);
  } else if (name === "ping") {
    note(1760, 0, 0.25);
  } else if (name === "alarm") {
    for (let i = 0; i < 4; i++) note(i % 2 ? 660 : 880, i * 0.22, 0.18, "square", 0.35);
  } else if (name === "soft") {
    note(523.25, 0, 0.7, "triangle", 0.8);
    note(659.25, 0.12, 0.7, "triangle", 0.6);
  }
}
module.exports = { SOUNDS, playSound };
