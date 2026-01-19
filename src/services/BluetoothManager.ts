/**
 * BLUETOOTH MANAGER
 * ==================
 * 
 * Production-ready wrapper for Web Bluetooth API.
 * Handles:
 * - Device discovery with standard filters (Heart Rate, Cycling, etc.)
 * - Permission checking (Chrome-specific)
 * - Automatic reconnection logic (via watchAdvertisements if supported)
 * - Connection state management
 * 
 * Browser Support:
 * - Chrome / Edge / Opera (Desktop & Android)
 * - Bluefy (iOS)
 * 
 * References:
 * - https://web.dev/devices-introduction/
 * - https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
 */

import { detectRuntime } from '../platform/runtime';

export interface BluetoothDeviceConfig {
    filters: BluetoothLEScanFilter[];
    optionalServices?: BluetoothServiceUUID[];
    acceptAllDevices?: boolean;
}

export type BluetoothState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export type BluetoothErrorCode =
    | 'NOT_SUPPORTED'
    | 'USER_CANCELLED'
    | 'PERMISSION_DENIED'
    | 'SECURITY'
    | 'GATT_UNAVAILABLE'
    | 'UNKNOWN';

export interface BluetoothError {
    code: BluetoothErrorCode;
    message: string;
    raw?: unknown;
}

export class BluetoothManager {
    private device: BluetoothDevice | null = null;
    private server: BluetoothRemoteGATTServer | null = null;
    private capDeviceId: string | null = null;
    private capDeviceName: string | undefined;
    private capInitPromise: Promise<void> | null = null;
    private state: BluetoothState = 'DISCONNECTED';
    private stateListeners = new Set<(state: BluetoothState) => void>();
    private valueListeners = new Set<(characteristic: string, value: DataView) => void>();
    private lastError: BluetoothError | null = null;

    private disconnectListenerAttached = false;
    private hrCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

    // Standard Heart Rate Service UUID
    public static readonly HR_SERVICE = 0x180D;
    public static readonly HR_MEASUREMENT = 0x2A37;
    public static readonly DEVICE_INFO_SERVICE = 0x180A;
    public static readonly BATTERY_SERVICE = 0x180F;
    public static readonly BATTERY_LEVEL = 0x2A19;
    public static readonly HR_CONTROL_POINT = 0x2A39;

    constructor() {
        // Try to restore previous session if any (rarely works in Web Bluetooth without user gesture, but useful for hint)
        this.loadLastDevice();
    }

    /**
     * Get current connection state
     */
    public getState(): BluetoothState {
        return this.state;
    }

    /**
     * Get last error (if any)
     */
    public getLastError(): BluetoothError | null {
        return this.lastError;
    }

    /**
     * Subscribe to state changes
     */
    public addStateListener(callback: (state: BluetoothState) => void): () => void {
        this.stateListeners.add(callback);
        return () => this.stateListeners.delete(callback);
    }

    /**
     * Subscribe to characteristic value changes
     */
    public addValueListener(callback: (char: string, value: DataView) => void): () => void {
        this.valueListeners.add(callback);
        return () => this.valueListeners.delete(callback);
    }

    /**
     * Backwards-compatible: replaces all listeners with a single callback.
     */
    public setOnStateChange(callback: (state: BluetoothState) => void) {
        this.stateListeners.clear();
        this.addStateListener(callback);
    }

    /**
     * Backwards-compatible: replaces all listeners with a single callback.
     */
    public setOnValueChange(callback: (char: string, value: DataView) => void) {
        this.valueListeners.clear();
        this.addValueListener(callback);
    }

    /**
     * Request a Bluetooth device
     */
    public async requestDevice(config: BluetoothDeviceConfig = {
        filters: [{ services: [BluetoothManager.HR_SERVICE] }],
        optionalServices: [BluetoothManager.DEVICE_INFO_SERVICE, BluetoothManager.BATTERY_SERVICE]
    }): Promise<boolean> {
        const hasWebBluetooth = typeof navigator !== 'undefined' && !!navigator.bluetooth;
        const runtime = detectRuntime();

        if (!hasWebBluetooth && runtime !== 'capacitor' && runtime !== 'tauri') {
            console.error('[Bluetooth] Bluetooth not supported in this runtime');
            this.lastError = { code: 'NOT_SUPPORTED', message: 'Bluetooth not supported in this runtime' };
            this.updateState('ERROR');
            return false;
        }

        try {
            console.log('[Bluetooth] Requesting device...');
            this.lastError = null;
            this.updateState('CONNECTING');

            if (hasWebBluetooth) {
                const device = await navigator.bluetooth.requestDevice(config);
                this.handleDeviceSelected(device);
            } else {
                await this.ensureCapacitorInitialized();
                const { BleClient, webUUIDToString } = await import('@capacitor-community/bluetooth-le');

                const filterServices = new Set<string>();
                for (const f of config.filters ?? []) {
                    for (const s of f.services ?? []) filterServices.add(webUUIDToString(s));
                }

                // For native pickers, services is the main filter. Default to HR service if none provided.
                if (filterServices.size === 0) filterServices.add(webUUIDToString(BluetoothManager.HR_SERVICE));

                const optional = new Set<BluetoothServiceUUID>([
                    ...(config.optionalServices ?? []),
                    BluetoothManager.DEVICE_INFO_SERVICE,
                    BluetoothManager.BATTERY_SERVICE,
                ]);

                const device = await BleClient.requestDevice({
                    services: [...filterServices],
                    optionalServices: [...optional].map((s) => webUUIDToString(s)),
                });

                this.capDeviceId = device.deviceId;
                this.capDeviceName = device.name;
                this.device = null;
                this.server = null;
            }

            return await this.connect();
        } catch (error) {
            const mapped = this.mapError(error);
            if (mapped.code === 'USER_CANCELLED') {
                console.log('[Bluetooth] Device picker cancelled');
                this.lastError = null;
                this.updateState('DISCONNECTED');
                return false;
            }

            console.error('[Bluetooth] Request failed:', error);
            this.lastError = mapped;
            this.updateState('ERROR');
            return false;
        }
    }

    /**
     * Connect to selected device
     */
    public async connect(): Promise<boolean> {
        const runtime = detectRuntime();

        if (!this.device && runtime !== 'capacitor') return false;
        if (runtime === 'capacitor' && !this.capDeviceId) return false;

        try {
            this.updateState('CONNECTING');
            this.lastError = null;

            if (runtime === 'capacitor') {
                await this.ensureCapacitorInitialized();
                const { BleClient } = await import('@capacitor-community/bluetooth-le');
                const deviceId = this.capDeviceId!;
                console.log(`[Bluetooth] (Capacitor) Connecting to ${this.capDeviceName ?? deviceId}...`);
                await BleClient.connect(deviceId, () => this.handleDisconnect());
                this.server = null;
                this.disconnectListenerAttached = false;
            } else {
                console.log(`[Bluetooth] Connecting to ${this.device!.name}...`);

                // Listen for disconnection (attach once)
                if (!this.disconnectListenerAttached) {
                    this.device!.addEventListener('gattserverdisconnected', this.handleDisconnect);
                    this.disconnectListenerAttached = true;
                }

                if (!this.device!.gatt) throw new Error('GATT not available');
                this.server = await this.device!.gatt.connect();

                if (!this.server) {
                    throw new Error('GATT server not available');
                }
            }

            console.log('[Bluetooth] Connected');
            this.updateState('CONNECTED');
            this.saveLastDevice(runtime === 'capacitor' ? this.capDeviceId! : this.device!.id);

            return true;
        } catch (error) {
            console.error('[Bluetooth] Connection failed:', error);
            this.lastError = this.mapError(error);
            this.updateState('ERROR');
            return false;
        }
    }

    /**
     * Disconnect
     */
    public disconnect() {
        this.stopHeartRateNotifications().catch(() => { });
        const runtime = detectRuntime();
        if (runtime === 'capacitor' && this.capDeviceId) {
            this.ensureCapacitorInitialized()
                .then(async () => {
                    const { BleClient } = await import('@capacitor-community/bluetooth-le');
                    await BleClient.disconnect(this.capDeviceId!);
                })
                .catch(() => { })
                .finally(() => this.handleDisconnect());
            return;
        }

        if (this.device && this.device.gatt?.connected) {
            this.device.gatt.disconnect();
            return;
        }

        // Already disconnected logic
        this.handleDisconnect();
    }

    /**
     * Start Heart Rate Notifications
     */
    public async startHeartRateNotifications(): Promise<boolean> {
        const runtime = detectRuntime();
        if (runtime === 'capacitor') {
            if (!this.capDeviceId) return false;
            try {
                await this.ensureCapacitorInitialized();
                const { BleClient, webUUIDToString } = await import('@capacitor-community/bluetooth-le');
                await BleClient.startNotifications(
                    this.capDeviceId,
                    webUUIDToString(BluetoothManager.HR_SERVICE),
                    webUUIDToString(BluetoothManager.HR_MEASUREMENT),
                    (value: DataView) => {
                        this.valueListeners.forEach((cb) => {
                            try { cb(webUUIDToString(BluetoothManager.HR_MEASUREMENT), value); } catch { }
                        });
                    }
                );
                console.log('[Bluetooth] (Capacitor) HR Notifications started');
                return true;
            } catch (error) {
                console.error('[Bluetooth] (Capacitor) Failed to start HR notifications:', error);
                return false;
            }
        }

        if (!this.server || !this.server.connected) return false;

        try {
            const service = await this.server.getPrimaryService(BluetoothManager.HR_SERVICE);
            const characteristic = await service.getCharacteristic(BluetoothManager.HR_MEASUREMENT);

            // Avoid duplicate listeners
            if (this.hrCharacteristic && this.hrCharacteristic !== characteristic) {
                await this.stopHeartRateNotifications();
            }

            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristicValueChanged);
            this.hrCharacteristic = characteristic;

            console.log('[Bluetooth] HR Notifications started');
            return true;
        } catch (error) {
            console.error('[Bluetooth] Failed to start HR notifications:', error);
            return false;
        }
    }

    public async stopHeartRateNotifications(): Promise<void> {
        const runtime = detectRuntime();
        if (runtime === 'capacitor' && this.capDeviceId) {
            try {
                await this.ensureCapacitorInitialized();
                const { BleClient, webUUIDToString } = await import('@capacitor-community/bluetooth-le');
                await BleClient.stopNotifications(
                    this.capDeviceId,
                    webUUIDToString(BluetoothManager.HR_SERVICE),
                    webUUIDToString(BluetoothManager.HR_MEASUREMENT)
                );
            } catch {
                // ignore
            }
            return;
        }

        if (!this.hrCharacteristic) return;
        try {
            this.hrCharacteristic.removeEventListener('characteristicvaluechanged', this.handleCharacteristicValueChanged);
            await this.hrCharacteristic.stopNotifications();
        } catch {
            // ignore
        } finally {
            this.hrCharacteristic = null;
        }
    }

    public async readBatteryLevel(): Promise<number | null> {
        const runtime = detectRuntime();
        if (runtime === 'capacitor') {
            if (!this.capDeviceId) return null;
            try {
                await this.ensureCapacitorInitialized();
                const { BleClient, webUUIDToString } = await import('@capacitor-community/bluetooth-le');
                const value = await BleClient.read(
                    this.capDeviceId,
                    webUUIDToString(BluetoothManager.BATTERY_SERVICE),
                    webUUIDToString(BluetoothManager.BATTERY_LEVEL)
                );
                return value.getUint8(0);
            } catch {
                return null;
            }
        }

        if (!this.server || !this.server.connected) return null;
        try {
            const service = await this.server.getPrimaryService(BluetoothManager.BATTERY_SERVICE);
            const characteristic = await service.getCharacteristic(BluetoothManager.BATTERY_LEVEL);
            const value = await characteristic.readValue();
            return value.getUint8(0);
        } catch {
            return null;
        }
    }

    public async readDeviceInfo(): Promise<{ manufacturer?: string; model?: string; serial?: string } | null> {
        const runtime = detectRuntime();
        if (runtime === 'capacitor') {
            if (!this.capDeviceId) return null;
            try {
                await this.ensureCapacitorInitialized();
                const { BleClient, webUUIDToString } = await import('@capacitor-community/bluetooth-le');
                const decode = (dv: DataView): string => {
                    const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
                    return new TextDecoder().decode(bytes);
                };

                const readString = async (uuid16: number): Promise<string | undefined> => {
                    try {
                        const dv = await BleClient.read(
                            this.capDeviceId!,
                            webUUIDToString(BluetoothManager.DEVICE_INFO_SERVICE),
                            webUUIDToString(uuid16)
                        );
                        return decode(dv);
                    } catch {
                        return undefined;
                    }
                };

                const [manufacturer, model, serial] = await Promise.all([
                    readString(0x2A29),
                    readString(0x2A24),
                    readString(0x2A25),
                ]);

                return { manufacturer, model, serial };
            } catch {
                return null;
            }
        }

        if (!this.server || !this.server.connected) return null;
        try {
            const service = await this.server.getPrimaryService(BluetoothManager.DEVICE_INFO_SERVICE);

            const readString = async (uuid16: number): Promise<string | undefined> => {
                try {
                    const c = await service.getCharacteristic(uuid16);
                    const dv = await c.readValue();
                    const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
                    return new TextDecoder().decode(bytes);
                } catch {
                    return undefined;
                }
            };

            const [manufacturer, model, serial] = await Promise.all([
                readString(0x2A29), // Manufacturer Name String
                readString(0x2A24), // Model Number String
                readString(0x2A25), // Serial Number String
            ]);

            return { manufacturer, model, serial };
        } catch {
            return null;
        }
    }

    public async writeCharacteristic(
        serviceUuid: BluetoothServiceUUID,
        characteristicUuid: BluetoothCharacteristicUUID,
        value: BufferSource,
        options?: { withResponse?: boolean }
    ): Promise<boolean> {
        const runtime = detectRuntime();
        const withResponse = options?.withResponse ?? true;

        const toDataView = (v: BufferSource): DataView => {
            if (v instanceof DataView) return v;
            if (v instanceof ArrayBuffer) return new DataView(v);
            return new DataView(v.buffer, v.byteOffset, v.byteLength);
        };

        if (runtime === 'capacitor') {
            if (!this.capDeviceId) return false;
            try {
                await this.ensureCapacitorInitialized();
                const { BleClient, webUUIDToString } = await import('@capacitor-community/bluetooth-le');
                const dv = toDataView(value);
                if (withResponse) {
                    await BleClient.write(this.capDeviceId, webUUIDToString(serviceUuid), webUUIDToString(characteristicUuid), dv);
                } else {
                    await BleClient.writeWithoutResponse(this.capDeviceId, webUUIDToString(serviceUuid), webUUIDToString(characteristicUuid), dv);
                }
                return true;
            } catch (error) {
                this.lastError = this.mapError(error);
                return false;
            }
        }

        if (!this.server || !this.server.connected) return false;
        try {
            const service = await this.server.getPrimaryService(serviceUuid);
            const characteristic = await service.getCharacteristic(characteristicUuid);

            if (withResponse && 'writeValueWithResponse' in characteristic) {
                await (characteristic as any).writeValueWithResponse(value);
            } else if (!withResponse && 'writeValueWithoutResponse' in characteristic) {
                await (characteristic as any).writeValueWithoutResponse(value);
            } else {
                await characteristic.writeValue(value);
            }
            return true;
        } catch (error) {
            this.lastError = this.mapError(error);
            return false;
        }
    }

    /**
     * Parse Heart Rate Measurement Value (0x2A37)
     */
    public static parseHeartRate(value: DataView): number {
        const flags = value.getUint8(0);
        const rate16Bits = flags & 0x1;
        let p = 1;

        let heartRate = 0;
        if (rate16Bits) {
            heartRate = value.getUint16(p, true); // Little Endian
            p += 2;
        } else {
            heartRate = value.getUint8(p);
            p += 1;
        }
        return heartRate;
    }

    /**
     * Get permission status (Chrome only)
     */
    public async checkPermissions(): Promise<PermissionState> {
        if (typeof navigator === 'undefined' || !navigator.permissions) return 'prompt';

        try {
            // @ts-ignore - 'bluetooth' not in standard types yet
            const status = await navigator.permissions.query({ name: 'bluetooth' });
            return status.state;
        } catch (e) {
            return 'prompt'; // Fallback
        }
    }

    /**
     * Handle device disconnection
     */
    private handleDisconnect = () => {
        console.log('[Bluetooth] Disconnected');
        this.stopHeartRateNotifications().catch(() => { });
        this.server = null;
        this.updateState('DISCONNECTED');
    };

    /**
     * Handle characteristic updates
     */
    private handleCharacteristicValueChanged = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (value) {
            this.valueListeners.forEach((cb) => {
                try { cb(target.uuid, value); } catch { }
            });
        }
    };

    /**
     * Handle device selection
     */
    private handleDeviceSelected(device: BluetoothDevice) {
        // Clean up any previous device listeners
        if (this.device && this.disconnectListenerAttached) {
            try { this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect); } catch { }
        }
        this.disconnectListenerAttached = false;
        this.hrCharacteristic = null;

        this.device = device;
        console.log('[Bluetooth] Device selected:', device.name, device.id);
    }

    /**
     * Update internal state
     */
    private updateState(newState: BluetoothState) {
        this.state = newState;
        this.stateListeners.forEach((cb) => {
            try { cb(newState); } catch { }
        });
    }

    // Persistence Helpers
    private saveLastDevice(id: string) {
        try { localStorage.setItem('zenb_last_bluetooth_id', id); } catch { }
    }

    private loadLastDevice() {
        let id: string | null = null;
        try { id = localStorage.getItem('zenb_last_bluetooth_id'); } catch { }
        if (id) {
            console.log('[Bluetooth] Found last device ID:', id);
            // Note: Cannot auto-connect in Web Bluetooth without new user gesture usually
            // but we could try watchAdvertisements if using experimental features
        }
    }

    public getLastDeviceId(): string | null {
        try { return localStorage.getItem('zenb_last_bluetooth_id'); } catch { return null; }
    }

    public clearLastDeviceId(): void {
        try { localStorage.removeItem('zenb_last_bluetooth_id'); } catch { }
    }

    public getSelectedDeviceInfo(): { id: string; name?: string } | null {
        const runtime = detectRuntime();
        if (runtime === 'capacitor' && this.capDeviceId) {
            return { id: this.capDeviceId, name: this.capDeviceName };
        }
        if (!this.device) return null;
        return { id: this.device.id, name: this.device.name };
    }

    public async getKnownDevices(): Promise<BluetoothDevice[]> {
        if (typeof navigator === 'undefined') return [];
        const bt: any = navigator.bluetooth as any;
        if (!bt?.getDevices) return [];
        try {
            const devices = (await bt.getDevices()) as BluetoothDevice[];
            return devices;
        } catch {
            return [];
        }
    }

    public async reconnectLastDevice(): Promise<boolean> {
        const lastId = this.getLastDeviceId();
        if (!lastId) return false;
        const runtime = detectRuntime();
        if (runtime === 'capacitor') {
            this.capDeviceId = lastId;
            try {
                await this.ensureCapacitorInitialized();
                const { BleClient } = await import('@capacitor-community/bluetooth-le');
                const devices = await BleClient.getDevices([lastId]).catch(() => []);
                const d = devices?.[0];
                this.capDeviceName = d?.name;
            } catch {
                // ignore
            }
            return this.connect();
        }

        const devices = await this.getKnownDevices();
        const device = devices.find((d) => d.id === lastId);
        if (!device) return false;
        this.handleDeviceSelected(device);
        return this.connect();
    }

    public async reconnectDevice(deviceId: string): Promise<boolean> {
        if (!deviceId) return false;
        const runtime = detectRuntime();
        if (runtime === 'capacitor') {
            this.capDeviceId = deviceId;
            try {
                await this.ensureCapacitorInitialized();
                const { BleClient } = await import('@capacitor-community/bluetooth-le');
                const devices = await BleClient.getDevices([deviceId]).catch(() => []);
                const d = devices?.[0];
                this.capDeviceName = d?.name;
            } catch {
                // ignore
            }
            return this.connect();
        }

        const devices = await this.getKnownDevices();
        const device = devices.find((d) => d.id === deviceId);
        if (!device) return false;
        this.handleDeviceSelected(device);
        return this.connect();
    }

    private mapError(error: unknown): BluetoothError {
        const e = error as any;
        const name = String(e?.name ?? '');
        const message = String(e?.message ?? 'Bluetooth error');
        const messageLower = message.toLowerCase();

        if (name === 'NotFoundError') {
            return { code: 'USER_CANCELLED', message: 'User cancelled device picker', raw: error };
        }
        if (messageLower.includes('cancel')) {
            return { code: 'USER_CANCELLED', message: 'User cancelled device picker', raw: error };
        }
        if (name === 'NotAllowedError') {
            return { code: 'PERMISSION_DENIED', message: message || 'Bluetooth permission denied', raw: error };
        }
        if (messageLower.includes('permission') && messageLower.includes('denied')) {
            return { code: 'PERMISSION_DENIED', message: message || 'Bluetooth permission denied', raw: error };
        }
        if (name === 'SecurityError') {
            return { code: 'SECURITY', message: message || 'Bluetooth blocked by security policy', raw: error };
        }
        if (message.includes('GATT')) {
            return { code: 'GATT_UNAVAILABLE', message, raw: error };
        }
        return { code: 'UNKNOWN', message, raw: error };
    }

    private async ensureCapacitorInitialized(): Promise<void> {
        if (this.capInitPromise) return this.capInitPromise;
        this.capInitPromise = (async () => {
            const { BleClient } = await import('@capacitor-community/bluetooth-le');
            await BleClient.initialize();
        })();
        return this.capInitPromise;
    }
}

export const bluetoothManager = new BluetoothManager();
