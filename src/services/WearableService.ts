/**
 * WEARABLE SERVICE - Multi-Provider Integration
 * ==============================================
 * 
 * Unified interface for fitness wearables:
 * - Apple Watch (HealthKit)
 * - Xiaomi Mi Band / Redmi Band (Zepp Health API)
 * - Fitbit (Web API)
 * - Garmin (Connect API)
 * 
 * Features:
 * - Connection state machine with retry logic
 * - Exponential backoff for failed connections
 * - Real-time HR streaming where supported
 */

import { useCallback, useEffect, useState } from 'react';

// =============================================================================
// LOGGING UTILITY
// =============================================================================

const logger = {
    info: (...args: any[]) => console.log('[Wearable]', ...args),
    warn: (...args: any[]) => console.warn('[Wearable]', ...args),
    error: (...args: any[]) => console.error('[Wearable]', ...args),
};

// =============================================================================
// TYPES
// =============================================================================

export type WearableProvider =
    | 'apple_watch'
    | 'xiaomi'        // Mi Band, Redmi Band, Amazfit
    | 'fitbit'
    | 'garmin'
    | 'none';

export type ConnectionState =
    | 'DISCONNECTED'
    | 'CONNECTING'
    | 'CONNECTED'
    | 'ERROR'
    | 'RECONNECTING';

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
    connectionState: ConnectionState;
    connectedDevice: WearableDevice | null;
    latestData: WearableData | null;
    isStreaming: boolean;
    lastError: string | null;
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
        sdkRequired: null,
        capabilities: ['heart_rate', 'steps', 'sleep', 'stress'],
        models: [
            'Mi Band 7', 'Mi Band 8', 'Redmi Band 2',
            'Redmi Watch 3', 'Amazfit GTR 4', 'Amazfit GTS 4', 'Amazfit Bip 5',
        ],
    },
    fitbit: {
        name: 'Fitbit',
        icon: '💪',
        description: 'Heart rate via Fitbit Web API',
        sdkRequired: null,
        capabilities: ['heart_rate', 'hrv', 'sleep', 'activity', 'spo2'],
        models: ['Sense 2', 'Versa 4', 'Charge 6', 'Inspire 3'],
    },
    garmin: {
        name: 'Garmin',
        icon: '🏃',
        description: 'Heart rate via Garmin Connect',
        sdkRequired: null,
        capabilities: ['heart_rate', 'hrv', 'stress', 'body_battery', 'respiration'],
        models: ['Venu 3', 'Forerunner 265', 'Vivosmart 5', 'Lily 2'],
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
// RETRY CONFIGURATION
// =============================================================================

interface RetryConfig {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 5,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
};

function getRetryDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelayMs * Math.pow(2, attempt);
    return Math.min(delay, config.maxDelayMs);
}

// =============================================================================
// BASE PROVIDER CLASS
// =============================================================================

abstract class BaseWearableProvider {
    protected connectionState: ConnectionState = 'DISCONNECTED';
    protected retryAttempt = 0;
    protected retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;
    protected retryTimeout: number | null = null;

    abstract getHeartRate(): Promise<number | null>;
    abstract getHrv(): Promise<{ rmssd: number; sdnn: number } | null>;
    abstract connect(): Promise<boolean>;
    abstract disconnect(): void;

    getConnectionState(): ConnectionState {
        return this.connectionState;
    }

    isConnected(): boolean {
        return this.connectionState === 'CONNECTED';
    }

    protected scheduleRetry(fn: () => Promise<boolean>): void {
        if (this.retryAttempt >= this.retryConfig.maxRetries) {
            this.connectionState = 'ERROR';
            logger.error('Max retries reached');
            return;
        }

        const delay = getRetryDelay(this.retryAttempt, this.retryConfig);
        this.connectionState = 'RECONNECTING';
        logger.info(`Retrying in ${delay}ms (attempt ${this.retryAttempt + 1})`);

        this.retryTimeout = window.setTimeout(async () => {
            this.retryAttempt++;
            const success = await fn();
            if (!success) {
                this.scheduleRetry(fn);
            }
        }, delay);
    }

    protected cancelRetry(): void {
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
        this.retryAttempt = 0;
    }
}

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

class XiaomiWearableService extends BaseWearableProvider {
    private _tokens: ZeppTokens | null = null;
    private config: ZeppAuthConfig | null = null;

    configure(config: ZeppAuthConfig) {
        this.config = config;
    }

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

    async connect(): Promise<boolean> {
        this.connectionState = 'CONNECTING';
        try {
            // In production: OAuth flow
            logger.info('📿 Connecting to Zepp Health...');

            // Mock successful connection
            this._tokens = {
                accessToken: 'mock_zepp_token',
                refreshToken: 'mock_refresh',
                expiresAt: Date.now() + 3600000,
            };

            this.connectionState = 'CONNECTED';
            this.retryAttempt = 0;
            return true;
        } catch (error) {
            logger.error('Zepp connection failed:', error);
            this.connectionState = 'ERROR';
            return false;
        }
    }

    disconnect(): void {
        this.cancelRetry();
        this._tokens = null;
        this.connectionState = 'DISCONNECTED';
    }

    async getHeartRate(): Promise<number | null> {
        if (!this.isConnected() || !this._tokens) return null;
        // Mock: GET https://open.zepp.com/v1/users/@me/heart_rate?date=today
        return 62 + Math.random() * 10;
    }

    async getHrv(): Promise<{ rmssd: number; sdnn: number } | null> {
        if (!this.isConnected()) return null;
        return { rmssd: 35 + Math.random() * 20, sdnn: 45 + Math.random() * 15 };
    }

    async getStressLevel(): Promise<number | null> {
        if (!this.isConnected()) return null;
        return Math.round(30 + Math.random() * 40);
    }
}

// =============================================================================
// APPLE WATCH / HEALTHKIT INTEGRATION
// =============================================================================

class AppleWatchService extends BaseWearableProvider {
    private streamCleanup: (() => void) | null = null;

    async connect(): Promise<boolean> {
        this.connectionState = 'CONNECTING';
        try {
            // In production: request HealthKit permissions
            logger.info('⌚ Requesting HealthKit authorization...');

            // Mock success
            this.connectionState = 'CONNECTED';
            return true;
        } catch (error) {
            logger.error('HealthKit auth failed:', error);
            this.connectionState = 'ERROR';
            return false;
        }
    }

    disconnect(): void {
        this.cancelRetry();
        if (this.streamCleanup) {
            this.streamCleanup();
            this.streamCleanup = null;
        }
        this.connectionState = 'DISCONNECTED';
    }

    async getHeartRate(): Promise<number | null> {
        if (!this.isConnected()) return null;
        return 65 + Math.random() * 8;
    }

    async getHrv(): Promise<{ rmssd: number; sdnn: number } | null> {
        if (!this.isConnected()) return null;
        return { rmssd: 35 + Math.random() * 30, sdnn: 45 + Math.random() * 25 };
    }

    startStreaming(callback: (hr: number) => void): () => void {
        logger.info('⌚ Starting Apple Watch HR stream...');
        const interval = setInterval(() => {
            const hr = 65 + Math.random() * 8;
            callback(hr);
        }, 5000);
        this.streamCleanup = () => clearInterval(interval);
        return this.streamCleanup;
    }
}

// =============================================================================
// FITBIT WEB API INTEGRATION
// =============================================================================

interface FitbitAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

interface FitbitTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    userId: string;
}

class FitbitWearableService extends BaseWearableProvider {
    private tokens: FitbitTokens | null = null;
    private config: FitbitAuthConfig | null = null;

    // OAuth2 endpoints (documented for production use)
    private readonly AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
    private readonly _TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
    private readonly _API_BASE = 'https://api.fitbit.com/1/user/-';

    configure(config: FitbitAuthConfig) {
        this.config = config;
    }

    getAuthUrl(): string {
        if (!this.config) throw new Error('FitbitService not configured');
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: 'heartrate sleep activity profile',
            expires_in: '604800', // 7 days
        });
        return `${this.AUTH_URL}?${params.toString()}`;
    }

    async exchangeCode(_code: string): Promise<boolean> {
        if (!this.config) return false;
        try {
            logger.info('💪 Exchanging Fitbit auth code...');

            // In production:
            // const resp = await fetch(this.TOKEN_URL, {
            //     method: 'POST',
            //     headers: {
            //         'Authorization': `Basic ${btoa(this.config.clientId + ':' + this.config.clientSecret)}`,
            //         'Content-Type': 'application/x-www-form-urlencoded',
            //     },
            //     body: new URLSearchParams({
            //         client_id: this.config.clientId,
            //         grant_type: 'authorization_code',
            //         redirect_uri: this.config.redirectUri,
            //         code,
            //     }),
            // });

            // Mock tokens
            this.tokens = {
                accessToken: 'mock_fitbit_token',
                refreshToken: 'mock_refresh',
                expiresAt: Date.now() + 604800000,
                userId: 'MOCK_USER',
            };
            this.connectionState = 'CONNECTED';
            return true;
        } catch (error) {
            logger.error('Fitbit auth failed:', error);
            return false;
        }
    }

    async connect(): Promise<boolean> {
        this.connectionState = 'CONNECTING';
        try {
            logger.info('💪 Connecting to Fitbit...');

            // Check if we have cached tokens
            if (this.tokens && this.tokens.expiresAt > Date.now()) {
                this.connectionState = 'CONNECTED';
                return true;
            }

            // Need OAuth flow
            // In browser: window.location.href = this.getAuthUrl();

            // Mock for now
            this.tokens = {
                accessToken: 'mock_fitbit_token',
                refreshToken: 'mock_refresh',
                expiresAt: Date.now() + 604800000,
                userId: 'MOCK_USER',
            };
            this.connectionState = 'CONNECTED';
            return true;
        } catch (error) {
            logger.error('Fitbit connection failed:', error);
            this.connectionState = 'ERROR';
            return false;
        }
    }

    disconnect(): void {
        this.cancelRetry();
        this.tokens = null;
        this.connectionState = 'DISCONNECTED';
    }

    async getHeartRate(): Promise<number | null> {
        if (!this.isConnected()) return null;

        try {
            // In production:
            // const today = new Date().toISOString().split('T')[0];
            // const resp = await fetch(
            //     `${this.API_BASE}/activities/heart/date/${today}/1d/1min.json`,
            //     { headers: { 'Authorization': `Bearer ${this.tokens.accessToken}` }}
            // );
            // const data = await resp.json();
            // Extract latest HR from data['activities-heart-intraday']['dataset']

            // Mock
            return 68 + Math.random() * 12;
        } catch (error) {
            logger.error('Failed to fetch Fitbit HR:', error);
            return null;
        }
    }

    async getHrv(): Promise<{ rmssd: number; sdnn: number } | null> {
        if (!this.isConnected()) return null;

        try {
            // In production:
            // GET https://api.fitbit.com/1/user/-/hrv/date/today.json

            // Mock
            return { rmssd: 38 + Math.random() * 25, sdnn: 50 + Math.random() * 20 };
        } catch (error) {
            logger.error('Failed to fetch Fitbit HRV:', error);
            return null;
        }
    }

    async getSleepData(): Promise<{ score: number; duration: number } | null> {
        if (!this.isConnected()) return null;
        // Mock sleep data
        return { score: 78 + Math.random() * 15, duration: 420 + Math.random() * 60 };
    }

    async getSpO2(): Promise<number | null> {
        if (!this.isConnected()) return null;
        // Mock SpO2 (Sense 2, Versa 4 only)
        return 96 + Math.random() * 3;
    }

    /** Get API endpoints for documentation/debugging */
    getApiInfo() {
        return {
            tokenUrl: this._TOKEN_URL,
            apiBase: this._API_BASE,
            isAuthenticated: !!this.tokens
        };
    }
}

// =============================================================================
// GARMIN CONNECT API INTEGRATION
// =============================================================================

interface GarminAuthConfig {
    consumerKey: string;
    consumerSecret: string;
    callbackUrl: string;
}

interface GarminTokens {
    accessToken: string;
    accessTokenSecret: string;
    expiresAt: number;
}

class GarminWearableService extends BaseWearableProvider {
    private _tokens: GarminTokens | null = null;
    private _config: GarminAuthConfig | null = null;

    // Garmin uses OAuth 1.0a + Wellness API (documented for production use)
    private readonly _REQUEST_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/request_token';
    private readonly _AUTH_URL = 'https://connect.garmin.com/oauthConfirm';
    private readonly _ACCESS_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/access_token';
    private readonly _WELLNESS_API = 'https://apis.garmin.com/wellness-api/rest';

    configure(config: GarminAuthConfig) {
        this._config = config;
    }

    async connect(): Promise<boolean> {
        this.connectionState = 'CONNECTING';
        try {
            logger.info('🏃 Connecting to Garmin Connect...');

            // OAuth 1.0a is complex - would need oauth-1.0a library
            // For now, mock connection
            this._tokens = {
                accessToken: 'mock_garmin_token',
                accessTokenSecret: 'mock_secret',
                expiresAt: Date.now() + 86400000,
            };
            this.connectionState = 'CONNECTED';
            return true;
        } catch (error) {
            logger.error('Garmin connection failed:', error);
            this.connectionState = 'ERROR';
            return false;
        }
    }

    disconnect(): void {
        this.cancelRetry();
        this._tokens = null;
        this.connectionState = 'DISCONNECTED';
    }


    async getHeartRate(): Promise<number | null> {
        if (!this.isConnected()) return null;

        try {
            // In production:
            // GET ${WELLNESS_API}/dailies?uploadStartTimeInSeconds=...
            // Extract restingHeartRateInBeatsPerMinute or use epochs

            // Mock
            return 64 + Math.random() * 10;
        } catch (error) {
            logger.error('Failed to fetch Garmin HR:', error);
            return null;
        }
    }

    async getHrv(): Promise<{ rmssd: number; sdnn: number } | null> {
        if (!this.isConnected()) return null;
        // Mock HRV
        return { rmssd: 40 + Math.random() * 20, sdnn: 48 + Math.random() * 18 };
    }

    async getStressLevel(): Promise<number | null> {
        if (!this.isConnected()) return null;
        // Garmin stress: 0-100
        return Math.round(25 + Math.random() * 50);
    }

    async getBodyBattery(): Promise<number | null> {
        if (!this.isConnected()) return null;
        // Garmin Body Battery: 0-100
        return Math.round(50 + Math.random() * 45);
    }

    async getRespirationRate(): Promise<number | null> {
        if (!this.isConnected()) return null;
        // Breaths per minute
        return 12 + Math.random() * 6;
    }

    /** Get API endpoints for documentation/debugging */
    getApiInfo() {
        return {
            requestTokenUrl: this._REQUEST_TOKEN_URL,
            authUrl: this._AUTH_URL,
            accessTokenUrl: this._ACCESS_TOKEN_URL,
            wellnessApi: this._WELLNESS_API,
            isConfigured: !!this._config,
            isAuthenticated: !!this._tokens
        };
    }
}

// =============================================================================
// UNIFIED WEARABLE SERVICE
// =============================================================================

class WearableService {
    private provider: WearableProvider = 'none';
    private xiaomiService = new XiaomiWearableService();
    private appleService = new AppleWatchService();
    private fitbitService = new FitbitWearableService();
    private garminService = new GarminWearableService();
    private streamCleanup: (() => void) | null = null;
    private lastError: string | null = null;

    setProvider(provider: WearableProvider) {
        // Disconnect from current provider
        this.disconnect();
        this.provider = provider;
    }

    getProvider(): WearableProvider {
        return this.provider;
    }

    getProviderConfig(): ProviderConfig {
        return WEARABLE_PROVIDERS[this.provider];
    }

    getCurrentService(): BaseWearableProvider | null {
        switch (this.provider) {
            case 'apple_watch': return this.appleService;
            case 'xiaomi': return this.xiaomiService;
            case 'fitbit': return this.fitbitService;
            case 'garmin': return this.garminService;
            default: return null;
        }
    }

    async connect(): Promise<boolean> {
        const service = this.getCurrentService();
        if (!service) return false;

        try {
            this.lastError = null;
            return await service.connect();
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : 'Connection failed';
            return false;
        }
    }

    disconnect(): void {
        if (this.streamCleanup) {
            this.streamCleanup();
            this.streamCleanup = null;
        }

        const service = this.getCurrentService();
        if (service) {
            service.disconnect();
        }
    }

    async getHeartRate(): Promise<number | null> {
        const service = this.getCurrentService();
        if (!service) return null;
        return service.getHeartRate();
    }

    async getHrv(): Promise<{ rmssd: number; sdnn: number } | null> {
        const service = this.getCurrentService();
        if (!service) return null;
        return service.getHrv();
    }

    async getData(): Promise<WearableData> {
        const hr = await this.getHeartRate();
        const hrv = await this.getHrv();

        let stressLevel = null;
        if (this.provider === 'xiaomi') {
            stressLevel = await this.xiaomiService.getStressLevel();
        } else if (this.provider === 'garmin') {
            stressLevel = await this.garminService.getStressLevel();
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

    startHeartRateStream(callback: (hr: number) => void) {
        if (this.provider === 'apple_watch') {
            this.streamCleanup = this.appleService.startStreaming(callback);
        } else {
            // For other providers, poll every 10 seconds
            const interval = setInterval(async () => {
                const hr = await this.getHeartRate();
                if (hr !== null) callback(hr);
            }, 10000);
            this.streamCleanup = () => clearInterval(interval);
        }
    }

    stopHeartRateStream() {
        if (this.streamCleanup) {
            this.streamCleanup();
            this.streamCleanup = null;
        }
    }

    getConnectionState(): ConnectionState {
        const service = this.getCurrentService();
        return service?.getConnectionState() || 'DISCONNECTED';
    }

    isConnected(): boolean {
        const service = this.getCurrentService();
        return service?.isConnected() || false;
    }

    getLastError(): string | null {
        return this.lastError;
    }

    // Provider-specific configuration
    configureXiaomi(config: ZeppAuthConfig) {
        this.xiaomiService.configure(config);
    }

    configureFitbit(config: FitbitAuthConfig) {
        this.fitbitService.configure(config);
    }

    configureGarmin(config: GarminAuthConfig) {
        this.garminService.configure(config);
    }
}

// Singleton instance
export const wearableService = new WearableService();

// =============================================================================
// REACT HOOK
// =============================================================================

export function useWearable() {
    const [provider, setProviderState] = useState<WearableProvider>(wearableService.getProvider());
    const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
    const [heartRate, setHeartRate] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setProvider = useCallback(async (p: WearableProvider) => {
        wearableService.setProvider(p);
        setProviderState(p);
        setConnectionState('DISCONNECTED');
        setHeartRate(null);
        setError(null);
    }, []);

    const connect = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const success = await wearableService.connect();
        setConnectionState(wearableService.getConnectionState());
        setIsLoading(false);

        if (success) {
            const hr = await wearableService.getHeartRate();
            setHeartRate(hr);
        } else {
            setError(wearableService.getLastError());
        }

        return success;
    }, []);

    const disconnect = useCallback(() => {
        wearableService.disconnect();
        setConnectionState('DISCONNECTED');
        setHeartRate(null);
    }, []);

    const refresh = useCallback(async () => {
        if (!wearableService.isConnected()) return;
        const hr = await wearableService.getHeartRate();
        setHeartRate(hr);
    }, []);

    // Poll heart rate while connected
    useEffect(() => {
        if (connectionState !== 'CONNECTED') return;

        const interval = setInterval(refresh, 10000);
        return () => clearInterval(interval);
    }, [connectionState, refresh]);

    // Sync connection state
    useEffect(() => {
        const check = setInterval(() => {
            setConnectionState(wearableService.getConnectionState());
        }, 1000);
        return () => clearInterval(check);
    }, []);

    return {
        provider,
        setProvider,
        connectionState,
        isConnected: connectionState === 'CONNECTED',
        isLoading,
        error,
        heartRate,
        connect,
        disconnect,
        refresh,
        providerConfig: WEARABLE_PROVIDERS[provider],
        availableProviders: Object.entries(WEARABLE_PROVIDERS).map(([key, config]) => ({
            id: key as WearableProvider,
            ...config,
        })),
    };
}
