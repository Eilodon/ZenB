
import React, { createContext, useContext, useRef, useEffect, useState } from 'react';
console.log('[ZenB] Module: KernelProvider.tsx loading...');
import { RustKernelBridge, RuntimeState } from '../services/RustKernelBridge';
import { audioMiddleware, hapticMiddleware } from '../services/kernelMiddleware';

const KernelContext = createContext<{ kernel: RustKernelBridge; state: RuntimeState } | null>(null);

export const KernelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const kernelRef = useRef<RustKernelBridge | null>(null);

  if (!kernelRef.current) {
    kernelRef.current = new RustKernelBridge();
    kernelRef.current.use(audioMiddleware);
    kernelRef.current.use(hapticMiddleware);
  }

  const [state, setState] = useState<RuntimeState>(kernelRef.current.getState());

  useEffect(() => {
    return kernelRef.current!.subscribe(setState);
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
