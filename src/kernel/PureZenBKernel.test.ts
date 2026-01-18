
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RustKernelBridge } from '../services/RustKernelBridge';

// Mock window for haptics
vi.stubGlobal('window', {
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
});

describe('RustKernelBridge (Rust FFI)', () => {
  let kernel: RustKernelBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    kernel = new RustKernelBridge();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- CORE & SAFETY ---

  it('should boot into IDLE', () => {
    expect(kernel.getState().status).toBe('IDLE');
  });

  it('should log BOOT event on construction', () => {
    const logs = kernel.getLogBuffer();
    expect(logs.some(e => e.type === 'BOOT')).toBe(true);
  });

  // --- AI INTEGRATION TESTS ---

  it('should track AI connection status', () => {
    expect(kernel.getState().aiActive).toBe(false);
    expect(kernel.getState().aiStatus).toBe('disconnected');

    kernel.dispatch({ type: 'AI_STATUS_CHANGE', status: 'connecting', timestamp: Date.now() });
    expect(kernel.getState().aiStatus).toBe('connecting');
    expect(kernel.getState().aiActive).toBe(true);

    kernel.dispatch({ type: 'AI_STATUS_CHANGE', status: 'thinking', timestamp: Date.now() });
    expect(kernel.getState().aiStatus).toBe('thinking');
  });

  it('should capture AI voice messages for UI display', () => {
    kernel.dispatch({ type: 'AI_VOICE_MESSAGE', text: "Slow down...", sentiment: "calm", timestamp: Date.now() });
    expect(kernel.getState().lastAiMessage).toBe("Slow down...");
    expect(kernel.getState().aiStatus).toBe('speaking');
  });

  it('should allow AI to adjust tempo via Tool Call (Active Inference Loop)', () => {
    kernel.dispatch({ type: 'LOAD_PROTOCOL', patternId: 'box', timestamp: Date.now() });
    kernel.dispatch({ type: 'START_SESSION', timestamp: Date.now() });

    // AI Tool Call: Adjust Tempo
    kernel.dispatch({
      type: 'ADJUST_TEMPO',
      scale: 1.2,
      reason: 'User HR too high',
      timestamp: Date.now()
    });

    expect(kernel.getState().tempoScale).toBe(1.2);
  });

  it('should clamp unsafe tempo adjustments to safety bounds', () => {
    // AI tries to set dangerous speed (0.5x is below 0.8 min)
    kernel.dispatch({
      type: 'ADJUST_TEMPO',
      scale: 0.5,
      reason: 'Hyperventilate',
      timestamp: Date.now()
    });

    // State should be clamped to minimum (0.8)
    expect(kernel.getState().tempoScale).toBe(0.8);
  });

  it('should log events in getLogBuffer', () => {
    kernel.dispatch({ type: 'LOAD_PROTOCOL', patternId: '4-7-8', timestamp: Date.now() });
    kernel.dispatch({ type: 'START_SESSION', timestamp: Date.now() });

    const logs = kernel.getLogBuffer();
    expect(logs.length).toBeGreaterThan(2);
    expect(logs.some(e => e.type === 'LOAD_PROTOCOL')).toBe(true);
    expect(logs.some(e => e.type === 'START_SESSION')).toBe(true);
  });
});
