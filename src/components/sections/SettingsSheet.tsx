
import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Smartphone, SmartphoneNfc, Music, Check, Terminal, ShieldAlert, Sparkles, Key, ExternalLink, TestTube2, Watch, WifiOff, Wifi, RefreshCw, Heart } from 'lucide-react';
import clsx from 'clsx';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUIStore } from '../../stores/uiStore';
import { TRANSLATIONS } from '../../translations';
import { SoundPack, BreathingType } from '../../types';
import { hapticTick } from '../../services/haptics';
import { CameraPermissionModal } from '../modals/CameraPermissionModal';
import { GestureBottomSheet } from '../../design-system';
import { HolodeckOverlay } from '../HolodeckOverlay';
import { useWearable, WEARABLE_PROVIDERS, WearableProvider } from '../../services/WearableService';

// Access window.aistudio via helper
const getAIStudio = () => (window as any).aistudio as {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
} | undefined;

export function SettingsSheet() {
  const isSettingsOpen = useUIStore(s => s.isSettingsOpen);
  const setSettingsOpen = useUIStore(s => s.setSettingsOpen);

  const userSettings = useSettingsStore(s => s.userSettings);
  const setLanguage = useSettingsStore(s => s.setLanguage);
  const toggleSound = useSettingsStore(s => s.toggleSound);
  const toggleHaptic = useSettingsStore(s => s.toggleHaptic);
  const setSoundPack = useSettingsStore(s => s.setSoundPack);
  const setQuality = useSettingsStore(s => s.setQuality);
  const setReduceMotion = useSettingsStore(s => s.setReduceMotion);
  const toggleTimer = useSettingsStore(s => s.toggleTimer);
  const toggleCameraVitals = useSettingsStore(s => s.toggleCameraVitals);
  const toggleKernelMonitor = useSettingsStore(s => s.toggleKernelMonitor);
  const resetSafetyLock = useSettingsStore(s => s.resetSafetyLock);
  const toggleAiCoach = useSettingsStore(s => s.toggleAiCoach);

  const [showCameraPermission, setShowCameraPermission] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showHolodeck, setShowHolodeck] = useState(false);

  // Check API Key status
  useEffect(() => {
    const aiStudio = getAIStudio();
    if (isSettingsOpen && aiStudio) {
      aiStudio.hasSelectedApiKey().then(setHasApiKey).catch(() => setHasApiKey(false));
    }
  }, [isSettingsOpen]);

  const t = TRANSLATIONS[userSettings.language] || TRANSLATIONS.en;
  const soundPacks: SoundPack[] = ['synth', 'breath', 'bells', 'real-zen', 'voice-full', 'voice-12'];

  const triggerHaptic = () => { if (userSettings.hapticEnabled) hapticTick(true, 'light'); };

  const handleCameraToggle = () => {
    triggerHaptic();
    if (!userSettings.cameraVitalsEnabled) {
      setShowCameraPermission(true);
    } else {
      toggleCameraVitals();
    }
  };

  const confirmCameraPermission = () => { setShowCameraPermission(false); toggleCameraVitals(); };
  const denyCameraPermission = () => { setShowCameraPermission(false); };

  const handleResetLocks = () => {
    triggerHaptic();
    ['4-7-8', 'box', 'calm', 'coherence'].forEach(id => resetSafetyLock(id as BreathingType));
  };

  const handleAiToggle = async () => {
    triggerHaptic();
    if (!userSettings.aiCoachEnabled) {
      const aiStudio = getAIStudio();
      if (aiStudio) {
        const hasKey = await aiStudio.hasSelectedApiKey();
        if (!hasKey) {
          try {
            await aiStudio.openSelectKey();
            setHasApiKey(true);
            toggleAiCoach();
          } catch (e) { console.error("API Key failed", e); }
        } else {
          toggleAiCoach();
        }
      } else {
        toggleAiCoach();
      }
    } else {
      toggleAiCoach();
    }
  };

  const handleChangeKey = async () => {
    triggerHaptic();
    const aiStudio = getAIStudio();
    if (aiStudio) {
      try { await aiStudio.openSelectKey(); setHasApiKey(true); if (!userSettings.aiCoachEnabled) toggleAiCoach(); } catch (e) { }
    }
  };

  return (
    <>
      {showHolodeck && <HolodeckOverlay onClose={() => setShowHolodeck(false)} />}
      {showCameraPermission && <CameraPermissionModal onAllow={confirmCameraPermission} onDeny={denyCameraPermission} />}

      <GestureBottomSheet
        open={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={t.settings.header}
      >
        <div className="space-y-10 pb-8">
          <section>
            <div className="text-white/30 font-caps text-[9px] tracking-[0.2em] mb-4 flex items-center gap-2 pl-1">{t.settings.language}</div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { triggerHaptic(); setLanguage('en'); }} className={clsx("p-4 rounded-2xl flex items-center justify-center gap-3 transition-all border", userSettings.language === 'en' ? "bg-white/10 border-white/20 text-white" : "bg-transparent border-white/5 text-white/30")}>
                <span className="text-xl">🇬🇧</span><span className="text-xs font-medium tracking-wide">English</span>
              </button>
              <button onClick={() => { triggerHaptic(); setLanguage('vi'); }} className={clsx("p-4 rounded-2xl flex items-center justify-center gap-3 transition-all border", userSettings.language === 'vi' ? "bg-white/10 border-white/20 text-white" : "bg-transparent border-white/5 text-white/30")}>
                <span className="text-xl">🇻🇳</span><span className="text-xs font-medium tracking-wide">Tiếng Việt</span>
              </button>
            </div>
          </section>

          <section>
            <div className="text-white/30 font-caps text-[9px] tracking-[0.2em] mb-4 flex items-center gap-2 pl-1">{t.settings.immersion}</div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { triggerHaptic(); toggleSound(); }} className={clsx("p-5 rounded-[1.5rem] flex flex-col items-center gap-3 transition-all border", userSettings.soundEnabled ? "bg-white/10 border-white/20 text-white" : "bg-transparent border-white/5 text-white/30")}>
                  {userSettings.soundEnabled ? <Volume2 size={24} strokeWidth={1} /> : <VolumeX size={24} strokeWidth={1} />}
                  <span className="text-xs font-medium tracking-wide">{t.settings.sounds}</span>
                </button>
                <button onClick={() => { triggerHaptic(); toggleHaptic(); }} className={clsx("p-5 rounded-[1.5rem] flex flex-col items-center gap-3 transition-all border", userSettings.hapticEnabled ? "bg-white/10 border-white/20 text-white" : "bg-transparent border-white/5 text-white/30")}>
                  {userSettings.hapticEnabled ? <Smartphone size={24} strokeWidth={1} /> : <SmartphoneNfc size={24} strokeWidth={1} />}
                  <span className="text-xs font-medium tracking-wide">{t.settings.haptics}</span>
                </button>
              </div>

              {userSettings.soundEnabled && (
                <div className="bg-white/[0.02] rounded-[1.5rem] border border-white/5 p-5">
                  <div className="text-[9px] text-white/40 uppercase font-bold mb-4 tracking-[0.2em] flex items-center gap-2"><Music size={12} /> {t.settings.soundPack}</div>
                  <div className="grid grid-cols-1 gap-1">
                    {soundPacks.map(pack => (
                      <button key={pack} onClick={() => { triggerHaptic(); setSoundPack(pack); }} className={clsx("w-full text-left px-4 py-3.5 rounded-xl text-xs font-medium tracking-wide transition-all flex items-center justify-between group", userSettings.soundPack === pack ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:bg-white/5 hover:text-white")}>
                        {t.settings.soundPacks[pack]}{userSettings.soundPack === pack && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="text-white/30 font-caps text-[9px] tracking-[0.2em] mb-4 flex items-center gap-2 pl-1">{t.settings.visuals}</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-5 bg-white/[0.02] rounded-[1.5rem] border border-white/5">
                <span className="text-sm font-light text-white/80">{t.settings.graphics}</span>
                <select value={userSettings.quality} onChange={(e) => setQuality(e.target.value as any)} className="bg-black/40 text-white text-xs py-2 px-4 rounded-lg border border-white/10 outline-none focus:border-white/30 appearance-none font-mono">
                  <option value="auto">{t.settings.quality.auto}</option>
                  <option value="low">{t.settings.quality.low}</option>
                  <option value="medium">{t.settings.quality.medium}</option>
                  <option value="high">{t.settings.quality.high}</option>
                </select>
              </div>
              <label className="flex items-center justify-between p-5 bg-white/[0.02] rounded-[1.5rem] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors">
                <span className="text-sm font-light text-white/80">{t.settings.reduceMotion}</span>
                <div className={clsx("w-11 h-6 rounded-full relative transition-colors border border-white/10", userSettings.reduceMotion ? "bg-white" : "bg-white/10")}>
                  <input type="checkbox" checked={userSettings.reduceMotion} onChange={(e) => { triggerHaptic(); setReduceMotion(e.target.checked); }} className="sr-only" />
                  <div className={clsx("absolute top-1 left-1 w-4 h-4 rounded-full shadow-sm transition-transform", userSettings.reduceMotion ? "bg-black translate-x-5" : "bg-white/50 translate-x-0")} />
                </div>
              </label>
              <label className="flex items-center justify-between p-5 bg-white/[0.02] rounded-[1.5rem] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors">
                <span className="text-sm font-light text-white/80">{t.settings.showTimer}</span>
                <div className={clsx("w-11 h-6 rounded-full relative transition-colors border border-white/10", userSettings.showTimer ? "bg-white" : "bg-white/10")}>
                  <input type="checkbox" checked={userSettings.showTimer} onChange={(_e) => { triggerHaptic(); toggleTimer(); }} className="sr-only" />
                  <div className={clsx("absolute top-1 left-1 w-4 h-4 rounded-full shadow-sm transition-transform", userSettings.showTimer ? "bg-black translate-x-5" : "bg-white/50 translate-x-0")} />
                </div>
              </label>
              <label className="flex items-center justify-between p-5 bg-white/[0.02] rounded-[1.5rem] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors">
                <div><div className="text-sm font-light text-white/80">Bio-Sensors (Camera)</div><div className="text-xs text-white/40 mt-1">Adaptive Control</div></div>
                <div className={clsx("w-11 h-6 rounded-full relative transition-colors border border-white/10", userSettings.cameraVitalsEnabled ? "bg-white" : "bg-white/10")}>
                  <input type="checkbox" checked={userSettings.cameraVitalsEnabled} onChange={handleCameraToggle} className="sr-only" />
                  <div className={clsx("absolute top-1 left-1 w-4 h-4 rounded-full shadow-sm transition-transform", userSettings.cameraVitalsEnabled ? "bg-black translate-x-5" : "bg-white/50 translate-x-0")} />
                </div>
              </label>
            </div>
          </section>

          <WearableSection triggerHaptic={triggerHaptic} />

          <section>
            <div className="text-white/30 font-caps text-[9px] tracking-[0.2em] mb-4 flex items-center gap-2 pl-1">Advanced Intelligence</div>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-5 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-[1.5rem] border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2"><Sparkles size={14} className="text-purple-400" />Gemini Neuro-Somatic AI</div>
                  <div className="text-[10px] text-white/50 mt-1 max-w-[200px]">Real-time voice coaching & adaptive protocol generation.</div>
                  <div className="flex gap-2 mt-2">
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white/60" onClick={(e) => e.stopPropagation()}>Pricing Info <ExternalLink size={8} /></a>
                  </div>
                </div>
                <div className={clsx("w-11 h-6 rounded-full relative transition-colors border border-white/10", userSettings.aiCoachEnabled ? "bg-purple-500" : "bg-white/10")}>
                  <input type="checkbox" checked={userSettings.aiCoachEnabled} onChange={handleAiToggle} className="sr-only" />
                  <div className={clsx("absolute top-1 left-1 w-4 h-4 rounded-full shadow-sm transition-transform bg-white", userSettings.aiCoachEnabled ? "translate-x-5" : "translate-x-0")} />
                </div>
              </label>

              <button onClick={handleChangeKey} className="w-full p-4 bg-white/5 rounded-xl flex items-center gap-3 text-white/60 hover:text-white hover:bg-white/10 transition-colors"><Key size={16} /><span className="text-xs font-mono">{hasApiKey ? "Change API Key" : "Select API Key"}</span></button>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { triggerHaptic(); toggleKernelMonitor(); setSettingsOpen(false); }} className="p-4 bg-white/5 rounded-xl flex items-center gap-3 text-white/60 hover:text-white hover:bg-white/10 transition-colors"><Terminal size={16} /><span className="text-xs font-mono">Kernel Monitor</span></button>
                <button onClick={() => { triggerHaptic(); setShowHolodeck(true); }} className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center gap-3 text-purple-300 hover:text-white hover:bg-purple-500/20 transition-colors"><TestTube2 size={16} /><span className="text-xs font-mono">Run Holodeck</span></button>
              </div>
              <button onClick={handleResetLocks} className="w-full p-4 bg-white/5 rounded-xl flex items-center gap-3 text-white/60 hover:text-red-300 hover:bg-red-500/10 transition-colors group"><ShieldAlert size={16} className="group-hover:text-red-400" /><span className="text-xs font-mono">Reset Safety Locks</span></button>
            </div>
          </section>

          <div className="pt-8 text-center"><div className="text-[10px] text-white/20 font-mono">ZenB Kernel v6.5 (Holodeck Enabled)</div></div>
        </div>
      </GestureBottomSheet>
    </>
  );
}

// =============================================================================
// WEARABLE SECTION COMPONENT
// =============================================================================

function WearableSection({ triggerHaptic }: { triggerHaptic: () => void }) {
  const {
    provider,
    setProvider,
    connectionState,
    isConnected,
    isLoading,
    error,
    heartRate,
    connect,
    disconnect,
    availableProviders
  } = useWearable();

  const [expanded, setExpanded] = useState(false);

  const handleProviderSelect = async (p: WearableProvider) => {
    triggerHaptic();
    await setProvider(p);
    setExpanded(false);
    if (p !== 'none') {
      await connect();
    }
  };

  const handleConnect = async () => {
    triggerHaptic();
    if (isConnected) {
      disconnect();
    } else {
      await connect();
    }
  };

  const currentProvider = WEARABLE_PROVIDERS[provider];

  return (
    <section>
      <div className="text-white/30 font-caps text-[9px] tracking-[0.2em] mb-4 flex items-center gap-2 pl-1">
        <Watch size={10} /> Wearable Devices
      </div>
      <div className="space-y-3">
        {/* Current Device Status */}
        <div className={clsx(
          "p-5 rounded-[1.5rem] border transition-all",
          isConnected
            ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20"
            : "bg-white/[0.02] border-white/5"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{currentProvider.icon}</div>
              <div>
                <div className="text-sm font-medium text-white">{currentProvider.name}</div>
                <div className="text-[10px] text-white/40 mt-0.5 flex items-center gap-2">
                  {connectionState === 'CONNECTED' && (
                    <><Wifi size={10} className="text-green-400" /> Connected</>
                  )}
                  {connectionState === 'CONNECTING' && (
                    <><RefreshCw size={10} className="text-yellow-400 animate-spin" /> Connecting...</>
                  )}
                  {connectionState === 'RECONNECTING' && (
                    <><RefreshCw size={10} className="text-yellow-400 animate-spin" /> Reconnecting...</>
                  )}
                  {connectionState === 'DISCONNECTED' && provider !== 'none' && (
                    <><WifiOff size={10} className="text-white/30" /> Not connected</>
                  )}
                  {connectionState === 'ERROR' && (
                    <><WifiOff size={10} className="text-red-400" /> Error</>
                  )}
                  {provider === 'none' && (
                    <>Using camera-based detection</>
                  )}
                </div>
              </div>
            </div>

            {/* Heart Rate Badge */}
            {isConnected && heartRate && (
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
                <Heart size={12} className="text-red-400 animate-pulse" />
                <span className="text-sm font-mono text-white">{Math.round(heartRate)}</span>
                <span className="text-xs text-white/50">bpm</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 text-xs text-red-400 bg-red-500/10 p-2 rounded-lg">{error}</div>
          )}

          {/* Connect/Disconnect Button */}
          {provider !== 'none' && (
            <button
              onClick={handleConnect}
              disabled={isLoading}
              className={clsx(
                "mt-4 w-full py-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2",
                isConnected
                  ? "bg-white/10 text-white/70 hover:bg-red-500/20 hover:text-red-300"
                  : "bg-white/10 text-white hover:bg-white/20",
                isLoading && "opacity-50"
              )}
            >
              {isLoading ? (
                <><RefreshCw size={14} className="animate-spin" /> Connecting...</>
              ) : isConnected ? (
                <><WifiOff size={14} /> Disconnect</>
              ) : (
                <><Wifi size={14} /> Connect</>
              )}
            </button>
          )}
        </div>

        {/* Change Device Button */}
        <button
          onClick={() => { triggerHaptic(); setExpanded(!expanded); }}
          className="w-full p-4 bg-white/5 rounded-xl flex items-center justify-between text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <span className="text-xs font-medium">Change Device</span>
          <Watch size={16} />
        </button>

        {/* Provider List */}
        {expanded && (
          <div className="bg-white/[0.02] rounded-[1.5rem] border border-white/5 p-3 space-y-1">
            {availableProviders.map(p => (
              <button
                key={p.id}
                onClick={() => handleProviderSelect(p.id)}
                className={clsx(
                  "w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 group",
                  provider === p.id
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:bg-white/5 hover:text-white"
                )}
              >
                <span className="text-xl">{p.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-[10px] text-white/30">{p.description}</div>
                </div>
                {provider === p.id && <Check size={16} className="text-green-400" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
