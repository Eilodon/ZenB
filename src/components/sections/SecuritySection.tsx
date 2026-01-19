import { useState } from 'react';
import { Shield, Lock, Key, AlertTriangle, Check } from 'lucide-react';
import clsx from 'clsx';
import { useSettingsStore } from '../../stores/settingsStore';
import { PassphraseSetup } from '../PassphraseSetup';

export function SecuritySection({ triggerHaptic }: { triggerHaptic: () => void }) {
    const hasPassphrase = useSettingsStore(s => s.userSettings.hasPassphrase);
    const setPassphrase = useSettingsStore(s => s.setPassphrase);
    const clearPassphrase = useSettingsStore(s => s.clearPassphrase);

    const [showPassphraseSetup, setShowPassphraseSetup] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const handleChangePassphrase = () => {
        triggerHaptic();
        setShowPassphraseSetup(true);
    };

    const handleClearPassphrase = () => {
        triggerHaptic();
        setShowClearConfirm(true);
    };

    const confirmClearPassphrase = () => {
        clearPassphrase();
        setShowClearConfirm(false);
        triggerHaptic();
    };

    const handlePassphraseComplete = async (passphrase: string | null) => {
        if (passphrase) {
            await setPassphrase(passphrase);
        }
        setShowPassphraseSetup(false);
    };

    if (showPassphraseSetup) {
        return (
            <PassphraseSetup
                onComplete={handlePassphraseComplete}
                onCancel={() => setShowPassphraseSetup(false)}
            />
        );
    }

    return (
        <>
            {/* Clear Passphrase Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card max-w-sm w-full p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-6 h-6 text-yellow-500" />
                            <h3 className="text-lg font-semibold">Clear Passphrase?</h3>
                        </div>
                        <p className="text-sm text-gray-400">
                            This will remove your passphrase and switch to device fingerprint encryption.
                            Your existing data will remain encrypted with the old passphrase.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowClearConfirm(false)}
                                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmClearPassphrase}
                                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                            >
                                Clear Passphrase
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <section>
                <div className="text-white/30 font-caps text-[9px] tracking-[0.2em] mb-4 flex items-center gap-2 pl-1">
                    <Shield size={10} /> Security & Privacy
                </div>
                <div className="space-y-3">
                    {/* Passphrase Status */}
                    <div className={clsx(
                        "p-5 rounded-[1.5rem] border transition-all",
                        hasPassphrase
                            ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20"
                            : "bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/20"
                    )}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className={clsx(
                                    "p-2 rounded-full",
                                    hasPassphrase ? "bg-green-500/20" : "bg-yellow-500/20"
                                )}>
                                    {hasPassphrase ? (
                                        <Lock className="w-4 h-4 text-green-400" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">
                                        {hasPassphrase ? 'Passphrase Encryption' : 'Device Fingerprint'}
                                    </div>
                                    <div className="text-[10px] text-white/40 mt-0.5">
                                        {hasPassphrase
                                            ? 'Your data is encrypted with a strong passphrase'
                                            : 'Using device fingerprint (weaker security)'}
                                    </div>
                                </div>
                            </div>
                            {hasPassphrase && (
                                <Check className="w-5 h-5 text-green-400" />
                            )}
                        </div>

                        {/* Security Info */}
                        <div className="text-[10px] text-white/30 bg-white/5 rounded-lg p-3 space-y-1">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-white/40" />
                                <span>Encryption: AES-256-GCM</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-white/40" />
                                <span>Integrity: HMAC-SHA256</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-white/40" />
                                <span>Key Derivation: PBKDF2 (100k iterations)</span>
                            </div>
                        </div>
                    </div>

                    {/* Passphrase Actions */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleChangePassphrase}
                            className="p-4 bg-white/5 rounded-xl flex items-center gap-3 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <Key size={16} />
                            <span className="text-xs font-medium">
                                {hasPassphrase ? 'Change' : 'Set'} Passphrase
                            </span>
                        </button>

                        {hasPassphrase && (
                            <button
                                onClick={handleClearPassphrase}
                                className="p-4 bg-white/5 rounded-xl flex items-center gap-3 text-white/60 hover:text-red-300 hover:bg-red-500/10 transition-colors group"
                            >
                                <AlertTriangle size={16} className="group-hover:text-red-400" />
                                <span className="text-xs font-medium">Clear</span>
                            </button>
                        )}
                    </div>

                    {/* Security Recommendations */}
                    {!hasPassphrase && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <Shield className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-yellow-200">
                                    <p className="font-medium mb-1">Security Recommendation</p>
                                    <p className="text-yellow-300/80">
                                        Set a passphrase for stronger encryption. Device fingerprint can be guessed by malicious extensions.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}
