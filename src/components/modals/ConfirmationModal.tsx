/**
 * AI ACTION CONFIRMATION MODAL
 * ============================
 * 
 * Displays when AI requests an action that requires user consent.
 * Part of the Safety-by-Construction architecture.
 */

import { useUIStore } from '../../stores/uiStore';
import { BREATHING_PATTERNS, BreathingType } from '../../types';

export function ConfirmationModal() {
    const pendingConfirmation = useUIStore(s => s.pendingConfirmation);
    const dismissConfirmation = useUIStore(s => s.dismissConfirmation);

    if (!pendingConfirmation) return null;

    const { toolName, args, reason } = pendingConfirmation;

    // Get pattern details if switching patterns
    const pattern = toolName === 'switch_pattern'
        ? BREATHING_PATTERNS[args.patternId as BreathingType]
        : null;

    const handleConfirm = () => {
        // Dispatch custom event for GeminiSomaticBridge to pick up
        window.dispatchEvent(new CustomEvent('zenb-confirmation', {
            detail: { confirmId: pendingConfirmation.confirmId, confirmed: true }
        }));
        dismissConfirmation();
    };

    const handleDeny = () => {
        window.dispatchEvent(new CustomEvent('zenb-confirmation', {
            detail: { confirmId: pendingConfirmation.confirmId, confirmed: false }
        }));
        dismissConfirmation();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="mx-4 max-w-sm rounded-2xl bg-surface-light/90 p-6 shadow-2xl backdrop-blur-xl border border-white/10">

                {/* Header */}
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                        <span className="text-xl">🤖</span>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">AI Coach Request</h2>
                        <p className="text-xs text-white/50">Confirmation Required</p>
                    </div>
                </div>

                {/* Reason */}
                <p className="mb-4 text-sm text-white/80">
                    {reason}
                </p>

                {/* Pattern Details (if applicable) */}
                {pattern && (
                    <div className="mb-4 rounded-lg bg-white/5 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white">{pattern.label}</span>
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                                High Arousal
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-white/60">{pattern.description}</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleDeny}
                        className="flex-1 rounded-xl border border-white/20 py-3 text-sm font-medium text-white/70 transition hover:bg-white/10"
                    >
                        Từ chối
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
                    >
                        Đồng ý
                    </button>
                </div>

                {/* Safety Note */}
                <p className="mt-3 text-center text-xs text-white/40">
                    This action is being requested by your AI coach
                </p>

            </div>
        </div>
    );
}
