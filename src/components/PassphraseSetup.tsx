import { useState } from 'react';
import { Eye, EyeOff, Lock, Shield, AlertTriangle } from 'lucide-react';

interface PassphraseSetupProps {
    onComplete: (passphrase: string | null) => void;
    onCancel: () => void;
}

/**
 * Passphrase Setup Component
 * 
 * Allows users to set a strong passphrase for encrypting biometric data.
 * Provides strength meter and option to use device fingerprint fallback.
 */
export function PassphraseSetup({ onComplete, onCancel }: PassphraseSetupProps) {
    const [passphrase, setPassphrase] = useState('');
    const [confirmPassphrase, setConfirmPassphrase] = useState('');
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [useDeviceFingerprint, setUseDeviceFingerprint] = useState(false);

    // Simple passphrase strength calculation
    const getStrength = (pass: string): { score: number; label: string; color: string } => {
        if (pass.length === 0) return { score: 0, label: '', color: '' };

        let score = 0;
        if (pass.length >= 8) score++;
        if (pass.length >= 12) score++;
        if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
        if (/\d/.test(pass)) score++;
        if (/[^a-zA-Z0-9]/.test(pass)) score++;

        if (score <= 1) return { score, label: 'Weak', color: 'text-red-500' };
        if (score <= 3) return { score, label: 'Medium', color: 'text-yellow-500' };
        return { score, label: 'Strong', color: 'text-green-500' };
    };

    const strength = getStrength(passphrase);
    const isValid = passphrase.length >= 8 && passphrase === confirmPassphrase;

    const handleSubmit = () => {
        if (useDeviceFingerprint) {
            onComplete(null); // null = use device fingerprint
        } else if (isValid) {
            onComplete(passphrase);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-card max-w-md w-full p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-blue-400" />
                    <div>
                        <h2 className="text-xl font-semibold">Secure Your Data</h2>
                        <p className="text-sm text-gray-400">Encrypt biometric events with a passphrase</p>
                    </div>
                </div>

                {/* Security Warning */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-200">
                        <p className="font-medium mb-1">Important Security Notice</p>
                        <p className="text-yellow-300/80">
                            Your passphrase encrypts heart rate, stress levels, and session data.
                            <strong className="text-yellow-200"> If you forget it, this data cannot be recovered.</strong>
                        </p>
                    </div>
                </div>

                {/* Device Fingerprint Option */}
                <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={useDeviceFingerprint}
                        onChange={(e) => setUseDeviceFingerprint(e.target.checked)}
                        className="mt-1"
                    />
                    <div className="text-sm">
                        <p className="font-medium group-hover:text-blue-400 transition-colors">
                            Use device fingerprint (convenience mode)
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                            Weaker security, but no passphrase to remember. Not recommended for sensitive data.
                        </p>
                    </div>
                </label>

                {/* Passphrase Input */}
                {!useDeviceFingerprint && (
                    <div className="space-y-4">
                        {/* Passphrase Field */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Passphrase</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type={showPassphrase ? 'text' : 'password'}
                                    value={passphrase}
                                    onChange={(e) => setPassphrase(e.target.value)}
                                    placeholder="Enter a strong passphrase"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-10 py-2.5 
                           focus:outline-none focus:border-blue-500/50 transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassphrase(!showPassphrase)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                >
                                    {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Strength Meter */}
                            {passphrase && (
                                <div className="mt-2">
                                    <div className="flex gap-1 mb-1">
                                        {[...Array(5)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={`h-1 flex-1 rounded-full transition-colors ${i < strength.score ? 'bg-current' : 'bg-gray-700'
                                                    } ${strength.color}`}
                                            />
                                        ))}
                                    </div>
                                    <p className={`text-xs ${strength.color}`}>
                                        Strength: {strength.label}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Confirm Passphrase */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Confirm Passphrase</label>
                            <input
                                type={showPassphrase ? 'text' : 'password'}
                                value={confirmPassphrase}
                                onChange={(e) => setConfirmPassphrase(e.target.value)}
                                placeholder="Re-enter passphrase"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 
                         focus:outline-none focus:border-blue-500/50 transition-colors"
                            />
                            {confirmPassphrase && passphrase !== confirmPassphrase && (
                                <p className="text-xs text-red-400 mt-1">Passphrases do not match</p>
                            )}
                        </div>

                        {/* Requirements */}
                        <div className="text-xs text-gray-400 space-y-1">
                            <p className="font-medium text-gray-300">Requirements:</p>
                            <ul className="list-disc list-inside space-y-0.5 ml-2">
                                <li className={passphrase.length >= 8 ? 'text-green-400' : ''}>
                                    At least 8 characters
                                </li>
                                <li className={/[a-z]/.test(passphrase) && /[A-Z]/.test(passphrase) ? 'text-green-400' : ''}>
                                    Mix of uppercase and lowercase
                                </li>
                                <li className={/\d/.test(passphrase) ? 'text-green-400' : ''}>
                                    At least one number
                                </li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg 
                     transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!useDeviceFingerprint && !isValid}
                        className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 
                     disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
                    >
                        {useDeviceFingerprint ? 'Use Device Fingerprint' : 'Set Passphrase'}
                    </button>
                </div>
            </div>
        </div>
    );
}
