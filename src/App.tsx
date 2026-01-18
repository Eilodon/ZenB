console.log('[ZenB] Module: App.tsx loading...');
import { useEffect, useState, useRef } from 'react';
import { useSessionStore } from './stores/sessionStore';
import { useSettingsStore } from './stores/settingsStore';
import { useUIStore } from './stores/uiStore';
import OrbBreathViz from './components/OrbBreathVizZenSciFi';
import { useEngine } from './engine/EngineProvider';
import { cleanupAudio, unlockAudio } from './services/audio';
import { BreathingType } from './types';
import { TRANSLATIONS } from './translations';
import { Header } from './components/sections/Header';
import { Footer } from './components/sections/Footer';
import { ActiveSessionDisplay } from './components/ActiveSessionDisplay';
import { OnboardingModal } from './components/modals/OnboardingModal';
import { SummaryModal } from './components/modals/SummaryModal';
import { HistorySheet } from './components/sections/HistorySheet';
import { SettingsSheet } from './components/sections/SettingsSheet';
import { KernelMonitor } from './components/KernelMonitor';
import { BREATHING_PATTERNS } from './types';
import { useKernel, useKernelState } from './kernel/KernelProvider';
import { GeminiSomaticBridge } from './services/GeminiSomaticBridge';
import { KineticSnackbar } from './design-system';
import { ConfirmationModal } from './components/modals/ConfirmationModal';
import { WakeLockManager } from './services/WakeLockManager';
import { OnlineStatusManager } from './services/OnlineStatusManager';

export default function App() {
  // --- SELECTORS ---
  const isActive = useSessionStore(s => s.isActive);
  const isPaused = useSessionStore(s => s.isPaused);
  const phase = useSessionStore(s => s.phase);
  const currentPattern = useSessionStore(s => s.currentPattern);
  const lastSessionStats = useSessionStore(s => s.lastSessionStats);

  const userSettings = useSettingsStore(s => s.userSettings);
  const hasSeenOnboarding = useSettingsStore(s => s.hasSeenOnboarding);
  const completeOnboarding = useSettingsStore(s => s.completeOnboarding);
  const toggleKernelMonitor = useSettingsStore(s => s.toggleKernelMonitor);

  const showSummary = useUIStore(s => s.showSummary);
  const setShowSummary = useUIStore(s => s.setShowSummary);
  const snackbar = useUIStore(s => s.snackbar);
  const hideSnackbar = useUIStore(s => s.hideSnackbar);

  // Core Engine (Biological OS Driver) - VIA SINGLETON CONTEXT
  const { progressRef, entropyRef } = useEngine();
  const kernel = useKernel();

  // v6.1: Subscribe to AI Status via Kernel Hook
  const aiStatus = useKernelState(s => s.aiStatus);

  const [selectedPatternId, setSelectedPatternId] = useState<BreathingType>(userSettings.lastUsedPattern || '4-7-8');
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true));

  useEffect(() => {
    setSelectedPatternId(userSettings.lastUsedPattern);
  }, [userSettings.lastUsedPattern]);

  const wakeLockManagerRef = useRef<WakeLockManager | null>(null);
  const bridgeRef = useRef<GeminiSomaticBridge | null>(null);
  const t = TRANSLATIONS[userSettings.language] || TRANSLATIONS.en;

  // --- ONLINE/OFFLINE STATUS ---
  useEffect(() => {
    const showSnackbar = useUIStore.getState().showSnackbar;
    let didInit = false;

    const mgr = new OnlineStatusManager({
      onChange: (online) => {
        setIsOnline(online);
        if (!didInit) { didInit = true; return; }
        showSnackbar(online ? t.ui.online : t.ui.offline, online ? 'success' : 'warn');
      }
    });

    mgr.start();
    return () => mgr.dispose();
  }, [t.ui.offline, t.ui.online]);

  useEffect(() => {
    const showSnackbar = useUIStore.getState().showSnackbar;
    const handleFallback = (event: Event) => {
      const detail = (event as CustomEvent).detail as { pack?: string; reason?: string };
      const packId = detail?.pack;
      const packLabel = packId && packId in t.settings.soundPacks
        ? t.settings.soundPacks[packId as keyof typeof t.settings.soundPacks]
        : (packId || t.settings.sounds);
      const message = t.ui.audioFallback.replace('{pack}', packLabel);
      showSnackbar(message, 'warn');

      // Keep label → audio behavior consistent: if a pack fails, switch settings to a safe fallback.
      if (packId === 'real-zen') {
        const { userSettings, setSoundPack } = useSettingsStore.getState();
        if (userSettings.soundPack === 'real-zen') setSoundPack('synth');
      }
    };
    window.addEventListener('zen:audio:fallback', handleFallback);
    return () => window.removeEventListener('zen:audio:fallback', handleFallback);
  }, [t]);

  // --- GEMINI SOMATIC BRIDGE LIFECYCLE ---
  useEffect(() => {
    const shouldConnect = userSettings.aiCoachEnabled && isActive && isOnline;

    if (shouldConnect) {
      if (!bridgeRef.current) bridgeRef.current = new GeminiSomaticBridge(kernel);
      bridgeRef.current.connect();
      return;
    }

    if (bridgeRef.current) {
      bridgeRef.current.disconnect();
      bridgeRef.current = null;
    }
  }, [userSettings.aiCoachEnabled, isActive, isOnline, kernel]);

  useEffect(() => {
    return () => {
      if (bridgeRef.current) {
        bridgeRef.current.disconnect();
        bridgeRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (lastSessionStats) {
      setShowSummary(true);
    }
  }, [lastSessionStats, setShowSummary]);

  const handleCloseSummary = () => {
    setShowSummary(false);
  };

  // GLOBAL AUDIO UNLOCKER & SECRET DEV GESTURE
  useEffect(() => {
    let tapCount = 0;
    let lastTap = 0;

    const handleTap = (e: MouseEvent | TouchEvent) => {
      // Audio Unlock
      unlockAudio();

      // Secret 5-tap top-right corner to toggle Kernel Monitor
      const x = 'clientX' in e ? e.clientX : e.touches[0].clientX;
      const y = 'clientY' in e ? e.clientY : e.touches[0].clientY;
      const w = window.innerWidth;

      if (x > w - 100 && y < 100) {
        const now = Date.now();
        if (now - lastTap < 500) {
          tapCount++;
        } else {
          tapCount = 1;
        }
        lastTap = now;

        if (tapCount === 5) {
          toggleKernelMonitor();
          tapCount = 0;
        }
      }
    };

    window.addEventListener('click', handleTap);
    window.addEventListener('touchstart', handleTap);
    return () => {
      window.removeEventListener('click', handleTap);
      window.removeEventListener('touchstart', handleTap);
    };
  }, [toggleKernelMonitor]);

  // Audio Cleanup
  useEffect(() => {
    if (!isActive) cleanupAudio();
  }, [isActive]);

  // ROBUST WAKE LOCK
  useEffect(() => {
    const mgr = new WakeLockManager({
      onError: (err) => console.warn('Wake Lock failed:', err),
    });
    wakeLockManagerRef.current = mgr;
    mgr.start();

    return () => {
      wakeLockManagerRef.current = null;
      void mgr.dispose();
    };
  }, []);

  useEffect(() => {
    wakeLockManagerRef.current?.setSessionState({ isActive, isPaused });
  }, [isActive, isPaused]);

  return (
    <div className="relative w-full min-h-dvh overflow-hidden bg-surface text-txt selection:bg-white/20 font-sans">

      {/* ---------------- LAYER 0: VISUAL CORTEX ---------------- */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <OrbBreathViz
          phase={phase}
          theme={isActive ? currentPattern.colorTheme : BREATHING_PATTERNS[selectedPatternId].colorTheme}
          quality={userSettings.quality}
          reduceMotion={userSettings.reduceMotion}
          progressRef={progressRef}
          entropyRef={entropyRef}
          isActive={isActive}
          aiStatus={aiStatus}
        />
      </div>

      {/* ---------------- LAYER 1: UI ORCHESTRATION ---------------- */}

      <Header />

      <ActiveSessionDisplay />

      <Footer
        selectedPatternId={selectedPatternId}
        setSelectedPatternId={setSelectedPatternId}
      />

      {/* ---------------- OVERLAYS ---------------- */}

      {!hasSeenOnboarding && <OnboardingModal onComplete={completeOnboarding} t={t} />}

      {showSummary && lastSessionStats && (
        <SummaryModal
          stats={lastSessionStats}
          onClose={handleCloseSummary}
          t={t}
          streak={userSettings.streak}
          language={userSettings.language}
        />
      )}

      {userSettings.showKernelMonitor && <KernelMonitor onClose={toggleKernelMonitor} />}

      {snackbar && (
        <KineticSnackbar
          key={snackbar.id}
          text={snackbar.text}
          kind={snackbar.kind}
          onClose={hideSnackbar}
        />
      )}

      <HistorySheet />
      <SettingsSheet />
      <ConfirmationModal />

    </div>
  );
}
