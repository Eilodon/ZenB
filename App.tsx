import React, { useEffect, useState } from 'react';
import { useBreathStore } from './store';
import OrbBreathViz from './components/OrbBreathViz';
import { useBreathEngine } from './hooks/useBreathEngine';
import { cleanupAudio } from './services/audio';
import { unlockAudio } from './services/audio';
import { BREATHING_PATTERNS, BreathingType } from './types';
import { Play, Pause, Square, Volume2, VolumeX, Smartphone, SmartphoneNfc, Zap, Settings2 } from 'lucide-react';
import clsx from 'clsx';

// --- Subcomponents ---

interface PatternCardProps {
  id: BreathingType;
  active: boolean;
  onSelect: () => void;
}

const PatternCard: React.FC<PatternCardProps> = ({ 
  id, 
  active, 
  onSelect 
}) => {
  const p = BREATHING_PATTERNS[id];
  return (
    <button
      onClick={onSelect}
      className={clsx(
        "flex flex-col items-start p-3 rounded-2xl transition-all duration-200 border text-left w-full sm:w-auto min-w-[140px]",
        active 
          ? "border-white bg-white/10 shadow-lg shadow-white/5" 
          : "border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
      )}
    >
      <span className="font-bold text-sm mb-1">{p.label}</span>
      <span className="text-xs opacity-60 font-mono">
        {p.timings.inhale}-{p.timings.holdIn}-{p.timings.exhale}-{p.timings.holdOut}
      </span>
    </button>
  );
};

interface ControlButtonProps {
  onClick: () => void;
  primary?: boolean;
  children: React.ReactNode;
}

const ControlButton: React.FC<ControlButtonProps> = ({ 
  onClick, 
  primary = false, 
  children 
}) => {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-200 active:scale-95",
        primary 
          ? "bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
          : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
      )}
    >
      {children}
    </button>
  );
};

// --- Main App ---

export default function App() {
  const { 
    isActive, isPaused, phase, cycleCount, currentPattern, userSettings,
    startSession, stopSession, togglePause, 
    toggleSound, toggleHaptic, setHapticStrength, setQuality, setReduceMotion 
  } = useBreathStore();

  const { progressRef } = useBreathEngine();
  const [selectedPattern, setSelectedPattern] = useState<BreathingType>(currentPattern.id as BreathingType);
  const [showSettings, setShowSettings] = useState(false);

  // Cleanup audio on stop or unmount
  useEffect(() => {
    if (!isActive) cleanupAudio();
  }, [isActive]);

  const handleStart = async () => {
    const unlocked = await unlockAudio();
    if (!unlocked) {
      // Optional: Show toast or feedback that audio is muted by system
    }
    startSession(selectedPattern);
  };

  const handleStop = () => {
    stopSession();
    cleanupAudio();
  };

  // Safe progress display for React render (only for text debug/display if needed, not visuals)
  const [debugProgress, setDebugProgress] = useState(0);
  useEffect(() => {
    if (!showSettings) return;
    const interval = setInterval(() => {
      setDebugProgress(progressRef.current);
    }, 100);
    return () => clearInterval(interval);
  }, [showSettings, progressRef]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-6">
      
      {/* Header */}
      <header className="w-full flex justify-between items-center z-10 relative max-w-md">
        <div>
          <h1 className="text-xl font-bold tracking-wide">ZENB</h1>
          <p className="text-xs text-white/50 uppercase tracking-widest mt-1">Guided Breath</p>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={clsx("p-2 rounded-full transition-colors", showSettings ? "bg-white/20 text-white" : "text-white/50 hover:text-white hover:bg-white/10")}
        >
          <Settings2 size={20} />
        </button>
      </header>

      {/* Main Visual Area */}
      <main className="absolute inset-0 flex items-center justify-center z-0">
        <div className="w-full h-full max-w-2xl max-h-[80vh]">
          <OrbBreathViz
            phase={phase}
            theme={currentPattern.colorTheme}
            quality={userSettings.quality}
            reduceMotion={userSettings.reduceMotion}
            progressRef={progressRef}
          />
        </div>
        
        {/* Phase Text Overlay */}
        {isActive && (
          <div className="absolute flex flex-col items-center pointer-events-none animate-in fade-in duration-700">
            <div className="text-sm uppercase tracking-[0.2em] text-white/40 mb-2">Phase</div>
            <div className="text-4xl font-black tracking-widest text-white drop-shadow-2xl">
              {phase === 'holdIn' || phase === 'holdOut' ? 'HOLD' : phase.toUpperCase()}
            </div>
            <div className="mt-8 text-sm font-mono text-white/30">
              Cycle: {cycleCount + 1}
            </div>
          </div>
        )}
      </main>

      {/* Settings Overlay Pane */}
      {showSettings && (
         <div className="absolute top-20 right-6 z-20 w-64 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-4 fade-in">
            <h3 className="text-xs font-bold uppercase text-white/50 mb-3">Audio & Haptics</h3>
            <div className="flex gap-2 mb-4">
              <button onClick={toggleSound} className={clsx("flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-sm", userSettings.soundEnabled ? "bg-white/20 text-white" : "bg-white/5 text-white/50")}>
                {userSettings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                Sound
              </button>
              <button onClick={toggleHaptic} className={clsx("flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-sm", userSettings.hapticEnabled ? "bg-white/20 text-white" : "bg-white/5 text-white/50")}>
                {userSettings.hapticEnabled ? <Smartphone size={16} /> : <SmartphoneNfc size={16} />}
                Haptic
              </button>
            </div>

            {userSettings.hapticEnabled && (
              <div className="mb-4">
                 <div className="text-xs text-white/40 mb-1">Intensity</div>
                 <div className="flex bg-white/5 rounded-lg p-1">
                    {(['light', 'medium', 'heavy'] as const).map(s => (
                      <button 
                        key={s}
                        onClick={() => setHapticStrength(s)}
                        className={clsx("flex-1 py-1 text-xs rounded capitalize transition-colors", userSettings.hapticStrength === s ? "bg-white/20 text-white" : "text-white/40")}
                      >
                        {s}
                      </button>
                    ))}
                 </div>
              </div>
            )}

            <h3 className="text-xs font-bold uppercase text-white/50 mb-3 border-t border-white/10 pt-3">Graphics</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/70">Quality</span>
                <select 
                  value={userSettings.quality}
                  onChange={(e) => setQuality(e.target.value as any)}
                  className="bg-white/10 border-none text-xs rounded px-2 py-1 text-white outline-none focus:ring-1 focus:ring-white/30"
                >
                  <option value="auto">Auto</option>
                  <option value="low">Low</option>
                  <option value="medium">Med</option>
                  <option value="high">High</option>
                </select>
              </div>
              <label className="flex items-center justify-between text-sm text-white/70 cursor-pointer">
                Reduce Motion
                <input 
                  type="checkbox" 
                  checked={userSettings.reduceMotion}
                  onChange={(e) => setReduceMotion(e.target.checked)}
                  className="accent-white bg-white/10 w-4 h-4 rounded"
                />
              </label>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-white/20 font-mono">
              Ref: {debugProgress.toFixed(3)}
            </div>
         </div>
      )}

      {/* Controls Footer */}
      <footer className="w-full z-10 max-w-md flex flex-col gap-6 animate-in slide-in-from-bottom-8 duration-500">
        
        {/* Pattern Selection (Only when inactive) */}
        {!isActive && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
            {Object.keys(BREATHING_PATTERNS).map((key) => (
              <PatternCard 
                key={key} 
                id={key as BreathingType} 
                active={selectedPattern === key}
                onSelect={() => setSelectedPattern(key as BreathingType)}
              />
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {!isActive ? (
            <ControlButton primary onClick={handleStart}>
              <Play size={20} fill="currentColor" /> Start Session
            </ControlButton>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <ControlButton onClick={togglePause}>
                {isPaused ? <Play size={20} /> : <Pause size={20} />}
                {isPaused ? "Resume" : "Pause"}
              </ControlButton>
              <ControlButton onClick={handleStop}>
                <Square size={20} fill="currentColor" />
                Stop
              </ControlButton>
            </div>
          )}
        </div>

      </footer>
    </div>
  );
}