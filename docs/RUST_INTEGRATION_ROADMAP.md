# ZenB Rust Core Integration Roadmap

> **Document Version**: 1.0.0
> **Last Updated**: 2026-01-19
> **Author**: Eidolon Architect Prime

---

## Current Status

### ✅ Fully Integrated (Tauri Desktop)
- Pattern management (`load_pattern`, `get_patterns`)
- Session lifecycle (`start_session`, `stop_session`, `pause`, `resume`)
- Timer-based tick (`tick`)
- Tempo control (`adjust_tempo`)
- Safety system (`emergency_halt`, `reset_safety_lock`)
- Belief state (`get_belief`) — **NEW**
- Safety status (`get_safety_status`) — **NEW**
- Context updates (`update_context`) — **NEW**

### ⚠️ Partially Integrated
- `process_frame` — Exposed but not utilized by CameraVitalsEngine

### ❌ Not Integrated
- Rust rPPG processing (TypeScript reimplementation used instead)
- zenb-store for persistent session history
- zenb-signals advanced features

---

## Architecture Gap Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CURRENT DATA FLOW (Suboptimal)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Camera → TensorFlow.js → FFT Worker → HR/HRV → TypeScript Kernel          │
│                ↓                                                            │
│           (60+ FPS)                                                         │
│                                                                             │
│  Rust Core: process_frame() sits IDLE                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    OPTIMAL DATA FLOW (To Implement)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Camera → Face Detection (TF.js) → RGB Extract → Rust process_frame()      │
│                                                      ↓                      │
│                                            zenb-signals::rppg              │
│                                                      ↓                      │
│                                            HR/HRV/Resonance → UI           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (COMPLETED)
- [x] Expose all Rust functions via Tauri commands
- [x] Add `get_belief`, `get_safety_status`, `update_context`
- [x] Document integration gaps

### Phase 2: Rust rPPG Integration (PLANNED)
**Effort**: ~4 hours
**Risk**: Medium (requires testing)

1. **Modify CameraVitalsEngine.v2.ts**:
   ```typescript
   // In processFrame(), after extracting RGB:
   if (isTauriAvailable()) {
     // Route to Rust for native-speed processing
     const frame = await tauriRuntime.process_frame(
       avgRGB.r, avgRGB.g, avgRGB.b,
       performance.now() * 1000
     );
     // Use frame.heart_rate, frame.signal_quality
   } else {
     // Fallback to TypeScript FFT worker
   }
   ```

2. **Performance Benefit**:
   - Rust rPPG: ~0.1ms per frame
   - TypeScript FFT Worker: ~5ms per frame
   - 50x speedup, lower battery drain

3. **Testing Required**:
   - Compare HR accuracy: Rust vs TypeScript
   - Verify signal quality metrics match
   - Test on low-end devices

### Phase 3: zenb-store Integration (PLANNED)
**Effort**: ~2 hours
**Risk**: Low

1. **Purpose**: Native persistent storage for:
   - Session history (currently in IndexedDB)
   - Safety registry (currently in localStorage)
   - Event logs (currently in memory)

2. **Benefits**:
   - Faster reads/writes (no JSON serialization)
   - Encryption at rest (Rust crypto)
   - Cross-platform consistency

3. **Implementation**:
   - Add `save_session`, `get_sessions`, `clear_history` commands
   - Migrate settingsStore persistence

### Phase 4: Full Signal Pipeline Migration (FUTURE)
**Effort**: ~8 hours
**Risk**: High

1. **Move to Rust**:
   - HRV computation (RMSSD, SDNN)
   - Respiration rate estimation
   - Affect inference (simplified model)

2. **Keep in TypeScript** (requires GPU):
   - Face landmark detection (TensorFlow.js)
   - EmoNet affect recognition (TensorFlow.js)
   - 3D visualization (Three.js)

---

## API Reference

### New Tauri Commands (v2)

```typescript
// Get current belief state
const belief = await invoke('get_belief');
// Returns: { probabilities: [0.4, 0.1, 0.2, 0.2, 0.1], confidence: 0.7, mode: 'Calm', uncertainty: 0.3 }

// Get safety status
const safety = await invoke('get_safety_status');
// Returns: { is_locked: false, trauma_count: 0, tempo_bounds: [0.8, 1.4], hr_bounds: [30, 220] }

// Update context for adaptive recommendations
await invoke('update_context', {
  localHour: new Date().getHours(),
  isCharging: navigator.getBattery?.()?.charging ?? false,
  recentSessions: sessionHistory.length
});
```

---

## Performance Benchmarks (Expected)

| Operation | TypeScript | Rust | Speedup |
|-----------|-----------|------|---------|
| rPPG per frame | 5ms | 0.1ms | 50x |
| HR computation | 20ms | 0.5ms | 40x |
| HRV computation | 50ms | 2ms | 25x |
| Belief update | 10ms | 0.2ms | 50x |

---

## Migration Checklist

When implementing Phase 2:

- [ ] Add feature flag: `ENABLE_RUST_RPPG`
- [ ] Implement A/B comparison mode
- [ ] Add metrics logging for accuracy comparison
- [ ] Test on: Windows, macOS, Linux
- [ ] Test on: High-end, mid-range, low-end devices
- [ ] Document any behavioral differences
- [ ] Update unit tests

---

*This roadmap ensures maximum Rust utilization while maintaining backward compatibility.*
