import { describe, expect, it } from 'vitest';
import { forgetWearableDeviceHistory, listWearableDeviceHistory, upsertWearableDeviceHistory } from './deviceRegistry';

describe('wearables/deviceRegistry', () => {
  it('upserts and forgets records (in-memory fallback)', async () => {
    await upsertWearableDeviceHistory({
      id: 'dev1',
      provider: 'generic_ble',
      name: 'Polar H10',
      model: 'H10',
      transport: 'unknown',
      lastConnectedAt: 1000,
      lastSeenAt: 1000,
    });

    await upsertWearableDeviceHistory({
      id: 'dev2',
      provider: 'generic_ble',
      name: 'Wahoo',
      transport: 'unknown',
      lastConnectedAt: 2000,
      lastSeenAt: 2000,
    });

    const list = await listWearableDeviceHistory();
    expect(list[0].id).toBe('dev2');
    expect(list[1].id).toBe('dev1');

    await forgetWearableDeviceHistory('generic_ble', 'dev1');
    const after = await listWearableDeviceHistory();
    expect(after.find((d) => d.id === 'dev1')).toBeUndefined();
  });
});

