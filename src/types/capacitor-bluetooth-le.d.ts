// Type declarations for Capacitor Community Bluetooth LE plugin
// This file helps TypeScript resolve the module when using bundler moduleResolution

declare module '@capacitor-community/bluetooth-le' {
    export interface BleDevice {
        deviceId: string;
        name?: string;
        uuids?: string[];
    }

    export interface RequestBleDeviceOptions {
        services?: string[];
        optionalServices?: string[];
        name?: string;
        namePrefix?: string;
        allowDuplicates?: boolean;
        scanMode?: 'lowPower' | 'balanced' | 'lowLatency';
    }

    export interface ScanResult {
        device: BleDevice;
        localName?: string;
        rssi?: number;
        txPower?: number;
        manufacturerData?: { [key: string]: DataView };
        serviceData?: { [key: string]: DataView };
        uuids?: string[];
        rawAdvertisement?: DataView;
    }

    export interface BleClientInterface {
        initialize(options?: { androidNeverForLocation?: boolean }): Promise<void>;
        isEnabled(): Promise<boolean>;
        requestEnable(): Promise<void>;
        enable(): Promise<void>;
        disable(): Promise<void>;
        startEnabledNotifications(callback: (enabled: boolean) => void): Promise<void>;
        stopEnabledNotifications(): Promise<void>;
        isLocationEnabled(): Promise<boolean>;
        openLocationSettings(): Promise<void>;
        openBluetoothSettings(): Promise<void>;
        openAppSettings(): Promise<void>;

        requestDevice(options?: RequestBleDeviceOptions): Promise<BleDevice>;
        requestLEScan(
            options?: RequestBleDeviceOptions,
            callback?: (result: ScanResult) => void
        ): Promise<void>;
        stopLEScan(): Promise<void>;

        getDevices(deviceIds: string[]): Promise<BleDevice[]>;
        getConnectedDevices(services: string[]): Promise<BleDevice[]>;

        connect(
            deviceId: string,
            onDisconnect?: (deviceId: string) => void,
            options?: { timeout?: number }
        ): Promise<void>;
        createBond(deviceId: string, options?: { timeout?: number }): Promise<void>;
        isBonded(deviceId: string): Promise<boolean>;
        disconnect(deviceId: string): Promise<void>;

        getServices(deviceId: string): Promise<string[]>;
        getMtu(deviceId: string): Promise<number>;
        requestConnectionPriority(
            deviceId: string,
            connectionPriority: 'balanced' | 'high' | 'lowPower'
        ): Promise<void>;

        read(deviceId: string, service: string, characteristic: string): Promise<DataView>;
        write(
            deviceId: string,
            service: string,
            characteristic: string,
            value: DataView
        ): Promise<void>;
        writeWithoutResponse(
            deviceId: string,
            service: string,
            characteristic: string,
            value: DataView
        ): Promise<void>;

        readDescriptor(
            deviceId: string,
            service: string,
            characteristic: string,
            descriptor: string
        ): Promise<DataView>;
        writeDescriptor(
            deviceId: string,
            service: string,
            characteristic: string,
            descriptor: string,
            value: DataView
        ): Promise<void>;

        startNotifications(
            deviceId: string,
            service: string,
            characteristic: string,
            callback: (value: DataView) => void
        ): Promise<void>;
        stopNotifications(
            deviceId: string,
            service: string,
            characteristic: string
        ): Promise<void>;

        readRssi(deviceId: string): Promise<number>;
    }

    export const BleClient: BleClientInterface;

    export function webUUIDToString(uuid: BluetoothServiceUUID | number): string;
    export function numberToUUID(value: number): string;
}
