/**
 * Rings and vibrates the phone to catch the crew's attention. The sound is a
 * synthesized cabin-chime "ding-dong" (Web Audio), so it needs no file and works
 * in airplane mode. Must be started from a tap so the browser allows sound.
 */
export const ATTENTION_MAX_MS = 60_000;
const EVERY_MS = 2200;

export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export function startAttention(onEnd?: () => void): () => void {
  let stopped = false;
  const Ctx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let ctx: AudioContext | null = null;
  try {
    ctx = Ctx ? new Ctx() : null;
  } catch {
    ctx = null;
  }

  const chime = () => {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    // High then low tone, like the cabin call chime.
    for (const [freq, at] of [[1318.5, 0], [1046.5, 0.45]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.7, t0 + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 1.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 1.3);
    }
  };
  const buzz = () => {
    if (canVibrate()) navigator.vibrate([500, 150, 500]);
  };
  const tick = () => {
    if (stopped) return;
    chime();
    buzz();
  };

  void ctx?.resume().catch(() => {});
  tick();
  const interval = setInterval(tick, EVERY_MS);
  // Never ring forever if the phone is left on the seat.
  const timeout = setTimeout(() => {
    stop();
    onEnd?.();
  }, ATTENTION_MAX_MS);

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(interval);
    clearTimeout(timeout);
    if (canVibrate()) navigator.vibrate(0);
    void ctx?.close().catch(() => {});
  }
  return stop;
}
