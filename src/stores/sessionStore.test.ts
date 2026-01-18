import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from './sessionStore';
import { BREATHING_PATTERNS } from '../types';

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      isActive: false,
      isPaused: false,
      cameraError: null,
      currentPattern: BREATHING_PATTERNS['4-7-8'],
      phase: 'inhale',
      cycleCount: 0,
      sessionStartTime: 0,
      lastSessionStats: null,
    });
  });

  it('startSession resets session state and clears cameraError', () => {
    useSessionStore.getState().setCameraError('Camera permission denied');
    useSessionStore.getState().togglePause();

    useSessionStore.getState().startSession('box');

    const state = useSessionStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.isPaused).toBe(false);
    expect(state.cameraError).toBe(null);
    expect(state.currentPattern.id).toBe('box');
    expect(state.phase).toBe('inhale');
    expect(state.cycleCount).toBe(0);
    expect(state.sessionStartTime).toBeGreaterThan(0);
    expect(state.lastSessionStats).toBe(null);
  });

  it('stopSession clears cameraError and resets control fields', () => {
    useSessionStore.getState().startSession('box');
    useSessionStore.getState().setCameraError('Some error');

    useSessionStore.getState().stopSession();

    const state = useSessionStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.cameraError).toBe(null);
    expect(state.phase).toBe('inhale');
    expect(state.cycleCount).toBe(0);
    expect(state.sessionStartTime).toBe(0);
  });

  it('finishSession computes stats when none provided and clears cameraError', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    useSessionStore.getState().startSession('4-7-8');
    useSessionStore.getState().setCameraError('Some error');
    useSessionStore.getState().syncState('exhale', 3);

    vi.setSystemTime(new Date('2026-01-01T00:01:05.000Z'));
    useSessionStore.getState().finishSession();

    const state = useSessionStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.cameraError).toBe(null);
    expect(state.lastSessionStats?.durationSec).toBe(65);
    expect(state.lastSessionStats?.cyclesCompleted).toBe(3);
    expect(state.lastSessionStats?.patternId).toBe('4-7-8');

    vi.useRealTimers();
  });
});

