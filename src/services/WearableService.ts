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

import { useCallback, useSyncExternalStore } from 'react';

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

import { BluetoothManager, bluetoothManager } from './BluetoothManager';
import { detectRuntime } from '../platform/runtime';
import { listWearableDeviceHistory, forgetWearableDeviceHistory, markWearableDeviceDisconnected, upsertWearableDeviceHistory, WearableDeviceHistoryRecord } from './wearables/deviceRegistry';
import { parseHeartRateMeasurement } from './wearables/hrMeasurement';
import { computeHrvFromRrMs } from './wearables/hrv';
import { RingBuffer } from './wearables/ringBuffer';

export type WearableProvider =
    | 'apple_watch'
    | 'xiaomi'        // Mi Band, Redmi Band, Amazfit
    | 'fitbit'
    | 'garmin'
    | 'generic_ble'
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
    provider: WearableProvider;
    runtime: 'web' | 'capacitor' | 'tauri' | 'unknown';
    isAvailable: boolean;
    connectionState: ConnectionState;
    connectedDevice: WearableDevice | null;
    latestData: WearableData | null;
    isStreaming: boolean;
    isLoading: boolean;
    lastError: string | null;
    deviceHistory: WearableDevice[];
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
    generic_ble: {
        name: 'Bluetooth LE',
        icon: '🔵',
        description: 'Standard Heart Rate Monitor (Polar, Wahoo, etc.)',
        sdkRequired: 'web-bluetooth',
        capabilities: ['heart_rate'],
        models: ['Polar H10', 'Wahoo Tickr', 'Generic BLE HR'],
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
    protected retryTimeout: ReturnType<typeof setTimeout> | null = null;

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

        this.retryTimeout = globalThis.setTimeout(async () => {
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
// GENERIC BLE INTEGRATION
// =============================================================================

class GenericBLEWearableService extends BaseWearableProvider {
    private currentHr: number | null = null;
    private heartRateTimestamp: number | null = null;
    private rrMs = new RingBuffer<number>(120);
    private latestHrv: { rmssd: number; sdnn: number } | null = null;
    private batteryLevel: number | null = null;
    private sensorContact: 'not_supported' | 'not_detected' | 'detected' = 'not_supported';
    private model: string | null = null;

    private listeners = new Set<() => void>();

    constructor() {
        super();
        // Sync state from manager
        bluetoothManager.addStateListener((state) => {
            this.connectionState = state === 'CONNECTED' ? 'CONNECTED'
                : state === 'CONNECTING' ? 'CONNECTING'
                    : state === 'ERROR' ? 'ERROR'
                        : 'DISCONNECTED';

            if (this.connectionState === 'CONNECTED') {
                this.retryAttempt = 0;
            } else if (this.connectionState === 'DISCONNECTED') {
                this.currentHr = null;
                this.heartRateTimestamp = null;
                this.rrMs.clear();
                this.latestHrv = null;
                this.batteryLevel = null;
                this.sensorContact = 'not_supported';
                this.model = null;
            }

            this.notify();
        });

        // Listen for HR updates
        bluetoothManager.addValueListener((_uuid, value) => {
            try {
                const m = parseHeartRateMeasurement(value);
                this.currentHr = m.heartRate;
                this.heartRateTimestamp = Date.now();
                this.sensorContact = m.sensorContact;

                if (m.rrIntervalsMs.length) {
                    this.rrMs.pushMany(m.rrIntervalsMs);
                    // Stabilize HRV: wait for a small window of RR intervals.
                    const rr = this.rrMs.toArray();
                    if (rr.length >= 10) {
                        this.latestHrv = computeHrvFromRrMs(rr);
                    }
                }
            } catch {
                // ignore malformed frames
            }

            this.notify();
        });
    }

    async connect(): Promise<boolean> {
        // Request device and connect
        // This triggers the browser picker
        const success = await bluetoothManager.requestDevice();
        if (success) {
            await bluetoothManager.startHeartRateNotifications();
            this.batteryLevel = await bluetoothManager.readBatteryLevel();
            const info = await bluetoothManager.readDeviceInfo();
            this.model = info?.model ?? null;
        }
        return success;
    }

    async reconnectLast(): Promise<boolean> {
        const success = await bluetoothManager.reconnectLastDevice();
        if (success) {
            await bluetoothManager.startHeartRateNotifications();
            this.batteryLevel = await bluetoothManager.readBatteryLevel();
            const info = await bluetoothManager.readDeviceInfo();
            this.model = info?.model ?? null;
            this.notify();
        }
        return success;
    }

    async reconnectDevice(deviceId: string): Promise<boolean> {
        const success = await bluetoothManager.reconnectDevice(deviceId);
        if (success) {
            await bluetoothManager.startHeartRateNotifications();
            this.batteryLevel = await bluetoothManager.readBatteryLevel();
            const info = await bluetoothManager.readDeviceInfo();
            this.model = info?.model ?? null;
            this.notify();
        }
        return success;
    }

    async resetEnergyExpended(): Promise<boolean> {
        // Heart Rate Control Point (0x2A39): 0x01 = Reset Energy Expended (if supported).
        const payload = new Uint8Array([0x01]);
        return bluetoothManager.writeCharacteristic(
            BluetoothManager.HR_SERVICE,
            BluetoothManager.HR_CONTROL_POINT,
            payload,
            { withResponse: true }
        );
    }

    disconnect(): void {
        bluetoothManager.disconnect();
    }

    async getHeartRate(): Promise<number | null> {
        return this.currentHr;
    }

    async getHrv(): Promise<{ rmssd: number; sdnn: number } | null> {
        return this.latestHrv;
    }

    getCurrentHeartRate(): number | null {
        return this.currentHr;
    }

    getCurrentHrv(): { rmssd: number; sdnn: number } | null {
        return this.latestHrv;
    }

    getBatteryLevel(): number | null {
        return this.batteryLevel;
    }

    getHeartRateTimestamp(): number | null {
        return this.heartRateTimestamp;
    }

    getSensorContact(): 'not_supported' | 'not_detected' | 'detected' {
        return this.sensorContact;
    }

    getModel(): string | null {
        return this.model;
    }

    subscribe(cb: () => void): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private notify() {
        this.listeners.forEach((cb) => {
            try { cb(); } catch { }
        });
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
    private bleService = new GenericBLEWearableService();
    private streamCleanup: (() => void) | null = null;

    private state: WearableServiceState;
    private subscribers = new Set<() => void>();
    private lastBleConnectionState: ConnectionState = 'DISCONNECTED';

    constructor() {
        const runtime = detectRuntime();
        this.state = {
            provider: this.provider,
            runtime,
            isAvailable: this.isProviderAvailable(this.provider),
            connectionState: 'DISCONNECTED',
            connectedDevice: null,
            latestData: null,
            isStreaming: false,
            isLoading: false,
            lastError: null,
            deviceHistory: [],
        };

        // Keep external state in sync for BLE (event-driven, no polling)
        this.bleService.subscribe(() => {
            if (this.provider !== 'generic_ble') return;
            this.syncFromBle();
        });

        void this.refreshDeviceHistory();
    }

    subscribe(cb: () => void): () => void {
        this.subscribers.add(cb);
        return () => this.subscribers.delete(cb);
    }

    getSnapshot(): WearableServiceState {
        return this.state;
    }

    private notify() {
        this.subscribers.forEach((cb) => {
            try { cb(); } catch { }
        });
    }

    private setState(patch: Partial<WearableServiceState>) {
        this.state = { ...this.state, ...patch };
        this.notify();
    }

    private isProviderAvailable(provider: WearableProvider): boolean {
        if (provider === 'none') return true;
        if (provider === 'generic_ble') {
            // Web Bluetooth (Chrome/Edge) OR native runtime adapters (Capacitor/Tauri; implemented separately)
            const bt = (globalThis as any)?.navigator?.bluetooth;
            if (bt) return true;
            const rt = detectRuntime();
            return rt === 'capacitor';
        }
        // Cloud providers are reachable from any runtime; actual auth is provider-dependent.
        return true;
    }

    setProvider(provider: WearableProvider) {
        // Disconnect from current provider
        this.disconnect();
        this.provider = provider;

        this.setState({
            provider,
            isAvailable: this.isProviderAvailable(provider),
            connectionState: provider === 'none' ? 'DISCONNECTED' : 'DISCONNECTED',
            connectedDevice: null,
            latestData: null,
            lastError: null,
        });
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
            case 'generic_ble': return this.bleService;
            default: return null;
        }
    }

    async connect(): Promise<boolean> {
        const service = this.getCurrentService();
        if (!service) {
            this.setState({ lastError: 'No wearable provider selected', connectionState: 'DISCONNECTED' });
            return false;
        }

        try {
            this.setState({ isLoading: true, lastError: null, connectionState: 'CONNECTING' });
            const ok = await service.connect();

            if (this.provider === 'generic_ble') {
                // BLE provider drives state via events; ensure we sync once post-connect.
                this.syncFromBle();
            } else {
                this.setState({ connectionState: service.getConnectionState() });
                const data = await this.getData();
                this.setState({
                    connectedDevice: ok ? {
                        id: `${this.provider}:account`,
                        name: WEARABLE_PROVIDERS[this.provider]?.name ?? this.provider,
                        provider: this.provider,
                        model: 'cloud',
                        isConnected: ok,
                        lastSync: new Date().toISOString(),
                    } : null,
                    latestData: ok ? data : null,
                });
            }

            if (!ok) {
                const err = bluetoothManager.getLastError();
                const msg = err?.message || 'Connection failed';
                // User cancel should not surface as an error banner.
                const suppressed = err?.code === 'USER_CANCELLED';
                this.setState({ lastError: suppressed ? null : msg, connectionState: suppressed ? 'DISCONNECTED' : 'ERROR' });
            }

            this.setState({ isLoading: false });
            return ok;
        } catch (error) {
            this.setState({
                isLoading: false,
                lastError: error instanceof Error ? error.message : 'Connection failed',
                connectionState: 'ERROR',
            });
            return false;
        }
    }

    async reconnectLast(): Promise<boolean> {
        if (this.provider !== 'generic_ble') return false;
        this.setState({ isLoading: true, lastError: null, connectionState: 'RECONNECTING' });
        const ok = await this.bleService.reconnectLast();
        this.syncFromBle();
        this.setState({ isLoading: false });
        return ok;
    }

    async reconnectDevice(deviceId: string): Promise<boolean> {
        if (this.provider !== 'generic_ble') return false;
        this.setState({ isLoading: true, lastError: null, connectionState: 'RECONNECTING' });
        const ok = await this.bleService.reconnectDevice(deviceId);
        this.syncFromBle();
        this.setState({ isLoading: false });
        return ok;
    }

    async resetEnergyExpended(): Promise<boolean> {
        if (this.provider !== 'generic_ble') return false;
        if (this.state.connectionState !== 'CONNECTED') return false;
        const ok = await this.bleService.resetEnergyExpended();
        if (!ok) {
            const err = bluetoothManager.getLastError();
            this.setState({ lastError: err?.message ?? 'Failed to write control point' });
        }
        return ok;
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

        if (this.provider !== 'none') {
            this.setState({
                connectionState: 'DISCONNECTED',
                latestData: null,
            });
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

        const batteryLevel = this.provider === 'generic_ble'
            ? this.bleService.getBatteryLevel()
            : null;

        const heartRateTimestamp = this.provider === 'generic_ble'
            ? this.bleService.getHeartRateTimestamp()
            : (hr ? Date.now() : null);

        return {
            heartRate: hr,
            heartRateTimestamp,
            hrv,
            steps: null,
            calories: null,
            sleepScore: null,
            stressLevel,
            batteryLevel,
        };
    }

    async refreshData(): Promise<void> {
        if (this.provider === 'generic_ble') {
            this.syncFromBle();
            return;
        }

        const data = await this.getData();
        this.setState({ latestData: data });
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
        return this.state.connectionState;
    }

    isConnected(): boolean {
        return this.state.connectionState === 'CONNECTED';
    }

    getLastError(): string | null {
        return this.state.lastError;
    }

    async refreshDeviceHistory(): Promise<void> {
        const list = await listWearableDeviceHistory();
        const devices: WearableDevice[] = list
            .filter((r) => r.provider in WEARABLE_PROVIDERS)
            .map((r) => ({
                id: r.id,
                name: r.name ?? 'Unknown device',
                provider: r.provider as WearableProvider,
                model: r.model ?? (r.provider === 'generic_ble' ? 'BLE Heart Rate' : 'cloud'),
                isConnected: this.state.provider === r.provider && this.state.connectedDevice?.id === r.id && this.state.connectionState === 'CONNECTED',
                lastSync: r.lastConnectedAt ? new Date(r.lastConnectedAt).toISOString() : null,
            }));
        this.setState({ deviceHistory: devices });
    }

    async forgetDevice(provider: WearableProvider, id: string): Promise<void> {
        if (provider === 'generic_ble') {
            if (this.state.connectedDevice?.id === id) this.disconnect();
            if (bluetoothManager.getLastDeviceId() === id) bluetoothManager.clearLastDeviceId();
        }
        await forgetWearableDeviceHistory(provider, id);
        await this.refreshDeviceHistory();
    }

    private syncFromBle() {
        const connectionState = this.bleService.getConnectionState();

        const hr = this.bleService.getCurrentHeartRate();
        const hrv = this.bleService.getCurrentHrv();
        const batteryLevel = this.bleService.getBatteryLevel();
        const heartRateTimestamp = this.bleService.getHeartRateTimestamp();

        const data: WearableData | null = (hr !== null || hrv !== null || batteryLevel !== null)
            ? {
                heartRate: hr,
                heartRateTimestamp,
                hrv,
                steps: null,
                calories: null,
                sleepScore: null,
                stressLevel: null,
                batteryLevel,
            }
            : null;

        const btErr = bluetoothManager.getLastError();
        const lastError =
            connectionState === 'ERROR'
                ? (btErr?.message ?? 'Bluetooth error')
                : null;

        const selected = bluetoothManager.getSelectedDeviceInfo();
        const model = this.bleService.getModel() ?? 'BLE Heart Rate';

        let connectedDevice = this.state.connectedDevice;
        if (selected) {
            connectedDevice = {
                id: selected.id,
                name: selected.name ?? 'BLE Device',
                provider: 'generic_ble',
                model,
                isConnected: connectionState === 'CONNECTED',
                lastSync: connectedDevice?.lastSync ?? (connectionState === 'CONNECTED' ? new Date().toISOString() : null),
            };
        } else if (connectedDevice && connectedDevice.provider === 'generic_ble') {
            connectedDevice = { ...connectedDevice, isConnected: connectionState === 'CONNECTED' };
        }

        // Persist connect/disconnect transitions into device history.
        if (connectionState !== this.lastBleConnectionState) {
            const now = Date.now();

            if (connectionState === 'CONNECTED' && this.lastBleConnectionState !== 'CONNECTED' && selected) {
                const record: WearableDeviceHistoryRecord = {
                    id: selected.id,
                    name: selected.name,
                    provider: 'generic_ble',
                    model,
                    transport: this.state.runtime,
                    lastConnectedAt: now,
                    lastBatteryLevel: batteryLevel ?? undefined,
                    lastSeenAt: now,
                };
                void upsertWearableDeviceHistory(record).then(() => this.refreshDeviceHistory());
            }

            if (connectionState === 'DISCONNECTED' && this.lastBleConnectionState === 'CONNECTED' && this.state.connectedDevice?.provider === 'generic_ble') {
                void markWearableDeviceDisconnected('generic_ble', this.state.connectedDevice.id).then(() => this.refreshDeviceHistory());
            }

            this.lastBleConnectionState = connectionState;
        }

        this.setState({
            isAvailable: this.isProviderAvailable('generic_ble'),
            connectionState,
            connectedDevice,
            latestData: data,
            lastError,
            // BLE updates imply connect flow completed (even if it failed).
            isLoading: connectionState === 'CONNECTING' || connectionState === 'RECONNECTING' ? this.state.isLoading : false,
        });
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
    const snapshot = useSyncExternalStore(
        (cb) => wearableService.subscribe(cb),
        () => wearableService.getSnapshot(),
        () => wearableService.getSnapshot()
    );

    const setProvider = useCallback(async (p: WearableProvider) => {
        wearableService.setProvider(p);
    }, []);

    const connect = useCallback(async () => {
        return wearableService.connect();
    }, []);

    const reconnectLast = useCallback(async () => {
        return wearableService.reconnectLast();
    }, []);

    const reconnectDevice = useCallback(async (deviceId: string) => {
        return wearableService.reconnectDevice(deviceId);
    }, []);

    const disconnect = useCallback(() => {
        wearableService.disconnect();
    }, []);

    const refresh = useCallback(async () => {
        await wearableService.refreshData();
    }, []);

    const refreshDeviceHistory = useCallback(async () => {
        await wearableService.refreshDeviceHistory();
    }, []);

    const forgetDevice = useCallback(async (provider: WearableProvider, id: string) => {
        await wearableService.forgetDevice(provider, id);
    }, []);

    const resetEnergyExpended = useCallback(async () => {
        return wearableService.resetEnergyExpended();
    }, []);

    return {
        provider: snapshot.provider,
        runtime: snapshot.runtime,
        isAvailable: snapshot.isAvailable,

        connectionState: snapshot.connectionState,
        isConnected: snapshot.connectionState === 'CONNECTED',
        isLoading: snapshot.isLoading,
        error: snapshot.lastError,

        connectedDevice: snapshot.connectedDevice,
        latestData: snapshot.latestData,
        heartRate: snapshot.latestData?.heartRate ?? null,
        hrv: snapshot.latestData?.hrv ?? null,
        batteryLevel: snapshot.latestData?.batteryLevel ?? null,

        deviceHistory: snapshot.deviceHistory,

        setProvider,
        connect,
        reconnectLast,
        reconnectDevice,
        disconnect,
        refresh,
        refreshDeviceHistory,
        forgetDevice,
        resetEnergyExpended,

        providerConfig: WEARABLE_PROVIDERS[snapshot.provider],
        availableProviders: Object.entries(WEARABLE_PROVIDERS).map(([key, config]) => ({
            id: key as WearableProvider,
            ...config,
        })),
    };
}
