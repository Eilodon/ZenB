
import React, { createContext, useContext, useRef, useEffect, useState } from 'react';
console.log('[ZenB] Module: KernelProvider.tsx loading...');
import { RustKernelBridge, RuntimeState } from '../services/RustKernelBridge';
import { audioMiddleware, hapticMiddleware, biofeedbackMiddleware, safetySyncMiddleware } from '../services/kernelMiddleware';
import { loadSafetyRegistry } from '../services/safetyRegistry';

const KernelContext = createContext<{ kernel: RustKernelBridge; state: RuntimeState } | null>(null);

export const KernelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const kernelRef = useRef<RustKernelBridge | null>(null);

  if (!kernelRef.current) {
    kernelRef.current = new RustKernelBridge();
    kernelRef.current.use(audioMiddleware);
    kernelRef.current.use(hapticMiddleware);
    kernelRef.current.use(biofeedbackMiddleware); // Active Inference Control
    kernelRef.current.use(safetySyncMiddleware);  // Eidolon Split-Brain Fix
  }

  const [state, setState] = useState<RuntimeState>(kernelRef.current.getState());

  useEffect(() => {
    return kernelRef.current!.subscribe(setState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const registry = await loadSafetyRegistry();
      if (cancelled) return;
      if (Object.keys(registry).length > 0) {
        kernelRef.current!.loadSafetyRegistry(registry);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <KernelContext.Provider value={{ kernel: kernelRef.current!, state }}>
      {children}
    </KernelContext.Provider>
  );
};

export function useKernel() {
  const ctx = useContext(KernelContext);
  if (!ctx) throw new Error("useKernel must be used within KernelProvider");
  return ctx.kernel;
}

export function useKernelState<T>(selector: (state: RuntimeState) => T): T {
  const ctx = useContext(KernelContext);
  if (!ctx) throw new Error("useKernelState must be used within KernelProvider");
  return selector(ctx.state);
}

// Note: BioFS health monitoring is now handled by Rust core
export const useBioFSHealth = () => ({ ok: true, bytesUsed: 0, bytesTotal: 0 });
