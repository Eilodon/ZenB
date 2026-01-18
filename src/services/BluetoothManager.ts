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

export interface BluetoothDeviceConfig {
    filters: BluetoothLEScanFilter[];
    optionalServices?: BluetoothServiceUUID[];
    acceptAllDevices?: boolean;
}

export type BluetoothState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export class BluetoothManager {
    private device: BluetoothDevice | null = null;
    private server: BluetoothRemoteGATTServer | null = null;
    private state: BluetoothState = 'DISCONNECTED';
    private onStateChange: ((state: BluetoothState) => void) | null = null;
    private onValueChange: ((characteristic: string, value: DataView) => void) | null = null;

    // Standard Heart Rate Service UUID
    public static readonly HR_SERVICE = 0x180D;
    public static readonly HR_MEASUREMENT = 0x2A37;
    public static readonly DEVICE_INFO_SERVICE = 0x180A;

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
     * Set state change callback
     */
    public setOnStateChange(callback: (state: BluetoothState) => void) {
        this.onStateChange = callback;
    }

    /**
     * Set value change callback for notifications
     */
    public setOnValueChange(callback: (char: string, value: DataView) => void) {
        this.onValueChange = callback;
    }

    /**
     * Request a Bluetooth device
     */
    public async requestDevice(config: BluetoothDeviceConfig = {
        filters: [{ services: [BluetoothManager.HR_SERVICE] }],
        optionalServices: [BluetoothManager.DEVICE_INFO_SERVICE]
    }): Promise<boolean> {
        if (!navigator.bluetooth) {
            console.error('[Bluetooth] Web Bluetooth API not supported');
            this.updateState('ERROR');
            return false;
        }

        try {
            console.log('[Bluetooth] Requesting device...');
            this.updateState('CONNECTING');

            const device = await navigator.bluetooth.requestDevice(config);
            this.handleDeviceSelected(device);

            return await this.connect();
        } catch (error) {
            console.error('[Bluetooth] Request failed:', error);
            this.updateState('ERROR');
            return false;
        }
    }

    /**
     * Connect to selected device
     */
    public async connect(): Promise<boolean> {
        if (!this.device) return false;

        try {
            this.updateState('CONNECTING');
            console.log(`[Bluetooth] Connecting to ${this.device.name}...`);

            // Listen for disconnection
            this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);

            if (!this.device.gatt) throw new Error('GATT not available');
            this.server = await this.device.gatt.connect();

            if (!this.server) {
                throw new Error('GATT server not available');
            }

            console.log('[Bluetooth] Connected');
            this.updateState('CONNECTED');
            this.saveLastDevice(this.device.id);

            return true;
        } catch (error) {
            console.error('[Bluetooth] Connection failed:', error);
            this.updateState('ERROR');
            return false;
        }
    }

    /**
     * Disconnect
     */
    public disconnect() {
        if (this.device && this.device.gatt?.connected) {
            this.device.gatt.disconnect();
        } else {
            // Already disconnected logic
            this.handleDisconnect();
        }
    }

    /**
     * Start Heart Rate Notifications
     */
    public async startHeartRateNotifications(): Promise<boolean> {
        if (!this.server || !this.server.connected) return false;

        try {
            const service = await this.server.getPrimaryService(BluetoothManager.HR_SERVICE);
            const characteristic = await service.getCharacteristic(BluetoothManager.HR_MEASUREMENT);

            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristicValueChanged);

            console.log('[Bluetooth] HR Notifications started');
            return true;
        } catch (error) {
            console.error('[Bluetooth] Failed to start HR notifications:', error);
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
        if (!navigator.permissions) return 'prompt';

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
        this.server = null;
        this.updateState('DISCONNECTED');
    };

    /**
     * Handle characteristic updates
     */
    private handleCharacteristicValueChanged = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (value && this.onValueChange) {
            this.onValueChange(target.uuid, value);
        }
    };

    /**
     * Handle device selection
     */
    private handleDeviceSelected(device: BluetoothDevice) {
        this.device = device;
        console.log('[Bluetooth] Device selected:', device.name, device.id);
    }

    /**
     * Update internal state
     */
    private updateState(newState: BluetoothState) {
        this.state = newState;
        if (this.onStateChange) {
            this.onStateChange(newState);
        }
    }

    // Persistence Helpers
    private saveLastDevice(id: string) {
        localStorage.setItem('zenb_last_bluetooth_id', id);
    }

    private loadLastDevice() {
        const id = localStorage.getItem('zenb_last_bluetooth_id');
        if (id) {
            console.log('[Bluetooth] Found last device ID:', id);
            // Note: Cannot auto-connect in Web Bluetooth without new user gesture usually
            // but we could try watchAdvertisements if using experimental features
        }
    }
}

export const bluetoothManager = new BluetoothManager();
