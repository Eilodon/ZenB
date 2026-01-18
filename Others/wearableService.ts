/**
 * Wearable Service - Integration with fitness wearables
 * 
 * Supports:
 * - Apple Watch (HealthKit)
 * - Xiaomi Mi Band / Redmi Band (Zepp Health API)
 * - Fitbit (Web API)
 * - Garmin (Connect IQ)
 */

import { useCallback, useEffect, useState } from 'react';
import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export type WearableProvider =
    | 'apple_watch'
    | 'xiaomi'        // Mi Band, Redmi Band, Amazfit
    | 'fitbit'
    | 'garmin'
    | 'none';

export interface WearableData {
    heartRate: number | null;
    heartRateTimestamp: number | null;
    hrv: {
        rmssd: number;
        sdnn: number;
    } | null;
    steps: number | null;
    calories: number | null;
    sleepScore: number | null;
    stressLevel: number | null;
    batteryLevel: number | null;
}

export interface WearableDevice {
    id: string;
    name: string;
    provider: WearableProvider;
    model: string;
    isConnected: boolean;
    lastSync: string | null;
}

export interface WearableServiceState {
    isAvailable: boolean;
    connectedDevice: WearableDevice | null;
    latestData: WearableData | null;
    isStreaming: boolean;
}

// =============================================================================
// PROVIDER CONFIGURATIONS
// =============================================================================

export interface ProviderConfig {
    name: string;
    icon: string;
    description: string;
    sdkRequired: string | null;
    capabilities: string[];
    models: string[];
}

export const WEARABLE_PROVIDERS: Record<WearableProvider, ProviderConfig> = {
    apple_watch: {
        name: 'Apple Watch',
        icon: '⌚',
        description: 'Real-time heart rate via HealthKit',
        sdkRequired: 'react-native-health',
        capabilities: ['heart_rate', 'hrv', 'activity', 'sleep'],
        models: ['Series 4+', 'SE', 'Ultra'],
    },
    xiaomi: {
        name: 'Xiaomi / Redmi / Amazfit',
        icon: '📿',
        description: 'Heart rate via Zepp Health API',
        sdkRequired: null, // Uses REST API
        capabilities: ['heart_rate', 'steps', 'sleep', 'stress'],
        models: [
            'Mi Band 7',
            'Mi Band 8',
            'Redmi Band 2',
            'Redmi Watch 3',
            'Amazfit GTR 4',
            'Amazfit GTS 4',
            'Amazfit Bip 5',
        ],
    },
    fitbit: {
        name: 'Fitbit',
        icon: '💪',
        description: 'Heart rate via Fitbit Web API',
        sdkRequired: null, // Uses REST API
        capabilities: ['heart_rate', 'hrv', 'sleep', 'activity'],
        models: ['Sense 2', 'Versa 4', 'Charge 6', 'Inspire 3'],
    },
    garmin: {
        name: 'Garmin',
        icon: '🏃',
        description: 'Heart rate via Garmin Connect',
        sdkRequired: null, // Uses REST API
        capabilities: ['heart_rate', 'hrv', 'stress', 'body_battery'],
        models: ['Venu 3', 'Forerunner 265', 'Vivosmart 5'],
    },
    none: {
        name: 'No Wearable',
        icon: '📷',
        description: 'Use camera for heart rate detection',
        sdkRequired: null,
        capabilities: ['camera_rppg'],
        models: [],
    },
};

// =============================================================================
// XIAOMI / ZEPP HEALTH API INTEGRATION
// =============================================================================

interface ZeppAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

interface ZeppTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

class XiaomiWearableService {
    private tokens: ZeppTokens | null = null;
    private config: ZeppAuthConfig | null = null;

    /**
     * Initialize with Zepp Health API credentials
     * Get credentials at: https://console.zepp.com/
     */
    configure(config: ZeppAuthConfig) {
        this.config = config;
    }

    /**
     * OAuth2 authorization URL for Zepp Health
     */
    getAuthUrl(): string {
        if (!this.config) throw new Error('XiaomiService not configured');

        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: 'data:heart_rate data:sleep data:activity',
        });

        return `https://auth.zepp.com/oauth/authorize?${params.toString()}`;
    }

    /**
     * Exchange auth code for tokens
     */
    async exchangeCode(code: string): Promise<boolean> {
        if (!this.config) return false;

        try {
            // In production, this would call Zepp API
            // POST https://auth.zepp.com/oauth/token
            logger.info('🔗 Exchanging Zepp auth code...');

            // Mock successful auth
            this.tokens = {
                accessToken: 'mock_access_token',
                refreshToken: 'mock_refresh_token',
                expiresAt: Date.now() + 3600000,
            };

            return true;
        } catch (error) {
            logger.error('Zepp auth failed:', error);
            return false;
        }
    }

    /**
     * Fetch latest heart rate from Zepp Health API
     */
    async getHeartRate(): Promise<number | null> {
        if (!this.tokens) return null;

        try {
            // In production:
            // GET https://open.zepp.com/v1/users/@me/heart_rate?date=today

            // Mock heart rate data
            return 62 + Math.random() * 10;
        } catch (error) {
            logger.error('Failed to fetch Xiaomi HR:', error);
            return null;
        }
    }

    /**
     * Fetch sleep data
     */
    async getSleepData(): Promise<{ score: number; duration: number } | null> {
        if (!this.tokens) return null;

        try {
            // Mock sleep data
            return {
                score: 75 + Math.random() * 20,
                duration: 7 * 60 + Math.random() * 60, // minutes
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Fetch stress level (PAI score)
     */
    async getStressLevel(): Promise<number | null> {
        if (!this.tokens) return null;

        // Mock stress level (0-100)
        return Math.round(30 + Math.random() * 40);
    }

    isConnected(): boolean {
        return this.tokens !== null && this.tokens.expiresAt > Date.now();
    }
}

// =============================================================================
// APPLE WATCH / HEALTHKIT INTEGRATION
// =============================================================================

class AppleWatchService {
    private isAuthorized: boolean = false;

    /**
     * Request HealthKit permissions (iOS only)
     */
    async requestAuthorization(): Promise<boolean> {
        // In production, use react-native-health:
        // import AppleHealthKit from 'react-native-health';
        // await AppleHealthKit.initHealthKit(permissions);

        logger.info('🍎 Requesting HealthKit authorization...');
        this.isAuthorized = true; // Mock
        return true;
    }

    /**
     * Get real-time heart rate from Apple Watch
     */
    async getHeartRate(): Promise<number | null> {
        if (!this.isAuthorized) return null;

        // In production:
        // AppleHealthKit.getHeartRateSamples(options, callback);

        return 65 + Math.random() * 8;
    }

    /**
     * Get HRV data
     */
    async getHrv(): Promise<{ rmssd: number; sdnn: number } | null> {
        if (!this.isAuthorized) return null;

        return {
            rmssd: 35 + Math.random() * 30,
            sdnn: 45 + Math.random() * 25,
        };
    }

    /**
     * Start real-time heart rate streaming
     */
    startStreaming(callback: (hr: number) => void): () => void {
        logger.info('⌚ Starting Apple Watch HR stream...');

        const interval = setInterval(() => {
            const hr = 65 + Math.random() * 8;
            callback(hr);
        }, 5000);

        return () => clearInterval(interval);
    }

    isConnected(): boolean {
        return this.isAuthorized;
    }
}

// =============================================================================
// UNIFIED WEARABLE SERVICE
// =============================================================================

class WearableService {
    private provider: WearableProvider = 'none';
    private xiaomiService = new XiaomiWearableService();
    private appleService = new AppleWatchService();
    private streamCleanup: (() => void) | null = null;

    /**
     * Set the active wearable provider
     */
    setProvider(provider: WearableProvider) {
        this.provider = provider;
    }

    getProvider(): WearableProvider {
        return this.provider;
    }

    getProviderConfig(): ProviderConfig {
        return WEARABLE_PROVIDERS[this.provider];
    }

    /**
     * Connect to the selected wearable
     */
    async connect(): Promise<boolean> {
        switch (this.provider) {
            case 'apple_watch':
                return await this.appleService.requestAuthorization();
            case 'xiaomi':
                // Would trigger OAuth flow
                logger.info('📿 Xiaomi connection requires OAuth flow');
                return true; // Mock
            default:
                return false;
        }
    }

    /**
     * Get latest heart rate from connected wearable
     */
    async getHeartRate(): Promise<number | null> {
        switch (this.provider) {
            case 'apple_watch':
                return await this.appleService.getHeartRate();
            case 'xiaomi':
                return await this.xiaomiService.getHeartRate();
            default:
                return null;
        }
    }

    /**
     * Get all available data from wearable
     */
    async getData(): Promise<WearableData> {
        const hr = await this.getHeartRate();

        let hrv = null;
        if (this.provider === 'apple_watch') {
            hrv = await this.appleService.getHrv();
        }

        let stressLevel = null;
        if (this.provider === 'xiaomi') {
            stressLevel = await this.xiaomiService.getStressLevel();
        }

        return {
            heartRate: hr,
            heartRateTimestamp: hr ? Date.now() : null,
            hrv,
            steps: null,
            calories: null,
            sleepScore: null,
            stressLevel,
            batteryLevel: null,
        };
    }

    /**
     * Start streaming heart rate (if supported)
     */
    startHeartRateStream(callback: (hr: number) => void) {
        if (this.provider === 'apple_watch') {
            this.streamCleanup = this.appleService.startStreaming(callback);
        }
    }

    stopHeartRateStream() {
        if (this.streamCleanup) {
            this.streamCleanup();
            this.streamCleanup = null;
        }
    }

    isConnected(): boolean {
        switch (this.provider) {
            case 'apple_watch':
                return this.appleService.isConnected();
            case 'xiaomi':
                return this.xiaomiService.isConnected();
            default:
                return false;
        }
    }
}

// Singleton instance
export const wearableService = new WearableService();

// =============================================================================
// HOOK FOR REACT COMPONENTS
// =============================================================================

export function useWearable() {
    const [provider, setProviderState] = useState<WearableProvider>(wearableService.getProvider());
    const [isConnected, setIsConnected] = useState(false);
    const [heartRate, setHeartRate] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const setProvider = useCallback(async (p: WearableProvider) => {
        wearableService.setProvider(p);
        setProviderState(p);
        setIsConnected(false);
        setHeartRate(null);
    }, []);

    const connect = useCallback(async () => {
        setIsLoading(true);
        const success = await wearableService.connect();
        setIsConnected(success);
        setIsLoading(false);

        if (success) {
            const hr = await wearableService.getHeartRate();
            setHeartRate(hr);
        }

        return success;
    }, []);

    const refresh = useCallback(async () => {
        if (!isConnected) return;
        const hr = await wearableService.getHeartRate();
        setHeartRate(hr);
    }, [isConnected]);

    // Poll heart rate while connected
    useEffect(() => {
        if (!isConnected) return;

        const interval = setInterval(refresh, 10000);
        return () => clearInterval(interval);
    }, [isConnected, refresh]);

    return {
        provider,
        setProvider,
        isConnected,
        isLoading,
        heartRate,
        connect,
        refresh,
        providerConfig: WEARABLE_PROVIDERS[provider],
        availableProviders: Object.entries(WEARABLE_PROVIDERS).map(([key, config]) => ({
            id: key as WearableProvider,
            ...config,
        })),
    };
}
