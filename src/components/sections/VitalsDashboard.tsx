/**
 * VITALS DASHBOARD
 * =================
 * Real-time display of camera-based vitals: HR, HRV, Stress, Mood
 * Uses existing CameraVitalsEngine via useCameraVitals hook.
 */

import { useState } from 'react';
import { Camera, CameraOff, Heart, Activity, Brain, Smile, AlertCircle, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useCameraVitals } from '../../hooks/useCameraVitals';
import { useSettingsStore } from '../../stores/settingsStore';

// =============================================================================
// TYPES
// =============================================================================

interface VitalCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number | undefined;
    unit?: string;
    quality: 'excellent' | 'good' | 'fair' | 'poor' | 'invalid';
    subValue?: string;
}

// =============================================================================
// VITALS CARD COMPONENT
// =============================================================================

function VitalCard({ icon, label, value, unit, quality, subValue }: VitalCardProps) {
    const qualityColors = {
        excellent: 'text-emerald-400',
        good: 'text-green-400',
        fair: 'text-yellow-400',
        poor: 'text-orange-400',
        invalid: 'text-white/30'
    };

    return (
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2 mb-1">
                <span className={clsx("opacity-60", qualityColors[quality])}>{icon}</span>
                <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex items-baseline gap-1">
                <span className={clsx("text-2xl font-light", qualityColors[quality])}>
                    {value !== undefined ? value : '--'}
                </span>
                {unit && <span className="text-xs text-white/40">{unit}</span>}
            </div>
            {subValue && <div className="text-[10px] text-white/30 mt-1">{subValue}</div>}
        </div>
    );
}

// =============================================================================
// MOOD DISPLAY
// =============================================================================

function MoodDisplay({ valence, arousal, label }: { valence?: number; arousal?: number; label?: string }) {
    // Map valence/arousal to emoji
    const getMoodEmoji = (v: number, a: number): string => {
        if (v > 0.3 && a > 0.3) return '😊'; // Happy/Excited
        if (v > 0.3 && a <= 0.3) return '😌'; // Calm/Content
        if (v <= -0.3 && a > 0.3) return '😰'; // Anxious/Stressed
        if (v <= -0.3 && a <= -0.3) return '😔'; // Sad
        return '😐'; // Neutral
    };

    const emoji = valence !== undefined && arousal !== undefined
        ? getMoodEmoji(valence, arousal)
        : '❓';

    return (
        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2 mb-1">
                <Smile size={14} className="text-purple-400/60" />
                <span className="text-[10px] text-white/40 uppercase tracking-wider">Mood</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-3xl">{emoji}</span>
                <div>
                    <div className="text-sm font-medium text-white/80 capitalize">
                        {label || 'Analyzing...'}
                    </div>
                    {valence !== undefined && arousal !== undefined && (
                        <div className="text-[10px] text-white/30">
                            V: {(valence * 100).toFixed(0)}% | A: {(arousal * 100).toFixed(0)}%
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// QUALITY INDICATOR BAR
// =============================================================================

function QualityBar({ quality, reasons }: { quality: string; reasons: string[] }) {
    const qualityMap: Record<string, { color: string; width: string; label: string }> = {
        excellent: { color: 'bg-emerald-500', width: 'w-full', label: 'Excellent' },
        good: { color: 'bg-green-500', width: 'w-4/5', label: 'Good' },
        fair: { color: 'bg-yellow-500', width: 'w-3/5', label: 'Fair' },
        poor: { color: 'bg-orange-500', width: 'w-2/5', label: 'Poor' },
        invalid: { color: 'bg-red-500', width: 'w-1/5', label: 'Invalid' }
    };

    const q = qualityMap[quality] || qualityMap.invalid;

    return (
        <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">Signal Quality</span>
                <span className="text-[10px] text-white/60">{q.label}</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={clsx("h-full rounded-full transition-all duration-500", q.color, q.width)} />
            </div>
            {reasons.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 text-[10px] text-yellow-300/60">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span>{reasons[0]}</span>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// MAIN DASHBOARD COMPONENT
// =============================================================================

export function VitalsDashboard() {
    const [expanded, setExpanded] = useState(false);
    const [cameraEnabled, setCameraEnabled] = useState(false);

    const { userSettings } = useSettingsStore();
    const language = userSettings.language;

    // Use the existing camera vitals hook
    const { vitals, isReady, error, guidance } = useCameraVitals(cameraEnabled);

    // Derived values
    const hr = vitals?.hr?.value;
    const hrQuality = vitals?.hr?.quality || 'invalid';
    const rr = vitals?.rr?.value;
    const rrQuality = vitals?.rr?.quality || 'invalid';
    const hrv = vitals?.hrv?.value;
    const hrvQuality = vitals?.hrv?.quality || 'invalid';
    const affect = vitals?.affect?.value;
    const overallQuality = vitals?.quality?.quality || 'invalid';

    return (
        <section className="mb-6">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/5 hover:bg-white/[0.05] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={clsx(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        cameraEnabled && isReady ? "bg-emerald-500/20" : "bg-white/10"
                    )}>
                        {cameraEnabled && isReady ? (
                            <Camera size={20} className="text-emerald-400" />
                        ) : (
                            <CameraOff size={20} className="text-white/40" />
                        )}
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-medium text-white/90">
                            {language === 'vi' ? 'Phân Tích Khuôn Mặt' : 'Face Analysis'}
                        </div>
                        <div className="text-[11px] text-white/40">
                            {cameraEnabled && isReady
                                ? (language === 'vi' ? 'Đang hoạt động' : 'Active')
                                : (language === 'vi' ? 'Chạm để mở' : 'Tap to enable')}
                        </div>
                    </div>
                </div>
                <ChevronDown
                    size={18}
                    className={clsx(
                        "text-white/40 transition-transform duration-300",
                        expanded && "rotate-180"
                    )}
                />
            </button>

            {/* Expanded Content */}
            <div className={clsx(
                "overflow-hidden transition-all duration-300",
                expanded ? "max-h-[600px] opacity-100 mt-3" : "max-h-0 opacity-0"
            )}>
                <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-4">

                    {/* Camera Toggle */}
                    {!cameraEnabled && (
                        <button
                            onClick={() => setCameraEnabled(true)}
                            className="w-full py-4 px-6 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl border border-purple-500/30 text-white/80 hover:from-purple-500/30 hover:to-blue-500/30 transition-all"
                        >
                            <Camera size={24} className="mx-auto mb-2 text-purple-400" />
                            <div className="text-sm font-medium">
                                {language === 'vi' ? 'Bật Camera để Phân Tích' : 'Enable Camera Analysis'}
                            </div>
                            <div className="text-[11px] text-white/40 mt-1">
                                {language === 'vi'
                                    ? 'Đo nhịp tim, stress, cảm xúc từ khuôn mặt'
                                    : 'Measure heart rate, stress, emotions from face'}
                            </div>
                        </button>
                    )}

                    {/* Error State */}
                    {cameraEnabled && error && (
                        <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/30 text-red-300 text-sm">
                            <AlertCircle size={16} className="inline mr-2" />
                            {error}
                        </div>
                    )}

                    {/* Loading State */}
                    {cameraEnabled && !isReady && !error && (
                        <div className="p-8 text-center">
                            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto" />
                            <div className="text-sm text-white/40 mt-3">
                                {language === 'vi' ? 'Đang khởi tạo camera...' : 'Initializing camera...'}
                            </div>
                        </div>
                    )}

                    {/* Active Vitals Display */}
                    {cameraEnabled && isReady && (
                        <>
                            {/* Vitals Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <VitalCard
                                    icon={<Heart size={14} />}
                                    label={language === 'vi' ? 'Nhịp Tim' : 'Heart Rate'}
                                    value={hr ? Math.round(hr) : undefined}
                                    unit="BPM"
                                    quality={hrQuality}
                                />
                                <VitalCard
                                    icon={<Activity size={14} />}
                                    label={language === 'vi' ? 'Nhịp Thở' : 'Respiration'}
                                    value={rr ? Math.round(rr) : undefined}
                                    unit="/min"
                                    quality={rrQuality}
                                />
                                <VitalCard
                                    icon={<Brain size={14} />}
                                    label="HRV"
                                    value={hrv?.rmssd ? Math.round(hrv.rmssd) : undefined}
                                    unit="ms"
                                    quality={hrvQuality}
                                    subValue={hrv?.stressIndex !== undefined
                                        ? `Stress: ${Math.round(hrv.stressIndex)}`
                                        : undefined}
                                />
                                <MoodDisplay
                                    valence={affect?.valence}
                                    arousal={affect?.arousal}
                                    label={affect?.moodLabel}
                                />
                            </div>

                            {/* Quality Bar */}
                            <QualityBar quality={overallQuality} reasons={guidance} />

                            {/* Stop Button */}
                            <button
                                onClick={() => setCameraEnabled(false)}
                                className="w-full mt-4 py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
                            >
                                {language === 'vi' ? 'Tắt Camera' : 'Disable Camera'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
