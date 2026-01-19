# ZenB Security Architecture

> **Document Version**: 1.0.0
> **Last Audit**: 2026-01-19
> **Auditor**: Eidolon Architect Prime

---

## Executive Summary

ZenB is a health application handling **sensitive biometric data** (heart rate, HRV, stress levels, facial affect). This document outlines the current security posture, known limitations, and remediation roadmap.

---

## Threat Model

### Assets Protected
1. **Biometric telemetry** (HR, HRV, respiration rate)
2. **Facial analysis data** (valence, arousal, attention)
3. **Session history** (patterns used, timestamps, outcomes)
4. **User preferences** (API keys, settings)

### Threat Actors
| Actor | Capability | Likelihood |
|-------|-----------|------------|
| Malicious Browser Extension | Full localStorage/IndexedDB access | Medium |
| XSS Attack | JavaScript execution in app context | Low (CSP enabled) |
| Physical Device Access | Direct storage inspection | Low |
| Compromised AI Endpoint | Malicious audio/commands | Very Low |
| Network MITM | Traffic interception | Very Low (HTTPS) |

---

## Current Security Controls

### ✅ Implemented

| Control | Status | Location |
|---------|--------|----------|
| Content Security Policy | **Enabled** | `src-tauri/tauri.conf.json` |
| HTTPS-only AI connection | Active | `GeminiSomaticBridge.ts` |
| Audio payload size limits | Active | `GeminiSomaticBridge.ts` (256KB max) |
| AI tool execution validation | Active | `AIToolRegistry.ts` |
| Rate limiting on tool calls | Active | `AIToolRegistry.ts` (5s/30s cooldowns) |
| Tempo bounds enforcement | Active | Rust core [0.8, 1.4] |
| HR bounds validation | Active | `SafetyConfig.ts` [30, 220] |
| Mutex safety (no panic) | Active | `parking_lot::Mutex` in Rust |
| Monotonic clock for rate limits | Active | `performance.now()` |

### ⚠️ Known Limitations

| Limitation | Risk | Mitigation Path |
|------------|------|-----------------|
| Unencrypted local storage when no passphrase | **High** | Require user passphrase or explicit opt-in |
| API key in localStorage | **Medium** | Use OS keychain via Tauri |
| Async state race conditions | **Medium** | Implement proper state sync |
| Event log unbounded | **Low** | Add size-based rotation |

---

## Security Architecture

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL ZONE (Untrusted)                    │
├─────────────────────────────────────────────────────────────────┤
│  • Gemini AI API (audio/text)                                   │
│  • Camera feed (raw pixels)                                     │
│  • Bluetooth wearables (HR data)                                │
│  • Network (fetch/websocket)                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │ VALIDATION GATE │
                   │                 │
                   │ • Audio size    │
                   │ • Tool schemas  │
                   │ • Rate limits   │
                   │ • Safety specs  │
                   └────────┬────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    INTERNAL ZONE (Trusted)                      │
├─────────────────────────────────────────────────────────────────┤
│  • RustKernelBridge (state management)                          │
│  • SafetyMonitor (LTL formal verification)                      │
│  • UKF State Estimator (belief computation)                     │
│  • Rust Core Engine (FFI boundary)                              │
└─────────────────────────────────────────────────────────────────┘
```

### Invariants (Must Never Break)

1. **Tempo ∈ [0.8, 1.4]** - Enforced at Rust FFI boundary
2. **HR ∈ [30, 220] BPM** - Enforced in SafetyConfig
3. **Single Kernel Instance** - React Context singleton
4. **Safety Lock blocks session start** - Enforced in Rust + TS
5. **AI cannot bypass safety monitor** - All tool calls validated

---

## Cryptographic Implementation

### Current: SecureBioFS

| Property | Implementation | Strength |
|----------|---------------|----------|
| Algorithm | AES-256-GCM | Strong |
| Key Derivation | PBKDF2 (100K iterations) | Strong |
| IV | Random 96-bit per event | Strong |
| Integrity | HMAC-SHA256 | Strong |
| **Key Source** | **User passphrase (required)** | **Strong** |

**Note**: If no passphrase is provided, the app uses an unencrypted local store for biometrics and metadata.

### Recommended: User Passphrase

```typescript
// Production recommendation:
await secureBioFS.init(userProvidedPassphrase);
```

### Future: WebAuthn

Consider hardware-backed keys via WebAuthn for maximum security.

---

## Incident Response

### If Biometric Data is Compromised

1. **Rotate encryption** - Generate new salt, re-encrypt all events
2. **Notify user** - Clear explanation of what was exposed
3. **Audit access** - Check for unauthorized API key usage

### If AI Coach is Compromised

1. **Disconnect immediately** - `bridge.disconnect()`
2. **Engage safety lock** - `kernel.dispatch({ type: 'SAFETY_INTERDICTION' })`
3. **Audit tool executions** - Review event log

---

## Remediation Roadmap

### P0 (Critical) - ✅ Completed
- [x] Enable Content Security Policy
- [x] Audio payload size validation
- [x] Fix Rust mutex panic risk

### P1 (High) - In Progress
- [ ] Move API key to OS keychain (Tauri secure storage)
- [x] Implement user passphrase for SecureBioFS
- [ ] Add proper Tauri async state synchronization

### P2 (Medium) - Planned
- [ ] Event log rotation (max 10MB or 7 days)
- [ ] Add integrity checks on Zustand persistence
- [ ] Implement CSP report-uri for violation logging

### P3 (Low) - Future
- [ ] WebAuthn integration for hardware-backed keys
- [ ] E2E encryption for optional cloud sync
- [ ] Formal verification of safety monitor specs

---

## Contact

Security issues should be reported to the maintainers via GitHub Issues with the `security` label.

---

*This document was generated as part of a deep security audit on 2026-01-19.*
