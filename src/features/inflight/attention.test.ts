import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ATTENTION_MAX_MS, startAttention } from "./attention";

describe("call-the-crew ring", () => {
  const vibrate = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    vibrate.mockClear();
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("window", {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("vibrates straight away and keeps repeating", () => {
    const stop = startAttention();
    expect(vibrate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2200 * 3);
    expect(vibrate).toHaveBeenCalledTimes(4);
    stop();
  });

  it("stops by itself after one minute", () => {
    const onEnd = vi.fn();
    startAttention(onEnd);
    vi.advanceTimersByTime(ATTENTION_MAX_MS);
    expect(ATTENTION_MAX_MS).toBe(60_000);
    expect(onEnd).toHaveBeenCalledTimes(1);
    const calls = vibrate.mock.calls.length;
    vi.advanceTimersByTime(10_000);
    expect(vibrate.mock.calls.length).toBe(calls);
    expect(vibrate).toHaveBeenLastCalledWith(0);
  });

  it("stop silences the vibration", () => {
    const stop = startAttention();
    stop();
    expect(vibrate).toHaveBeenLastCalledWith(0);
  });
});
