import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecureBioFS } from './SecureBioFS';
import { KernelEvent } from '../types';

describe('SecureBioFS - Event Log Rotation', () => {
    let fs: SecureBioFS;

    beforeEach(async () => {
        fs = new SecureBioFS();
        await fs.init('test-passphrase-123');
    });

    it('should cleanup events older than 7 days', async () => {
        const now = Date.now();
        const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);
        const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000);

        // Write old event
        await fs.writeEvent({
            type: 'BOOT',
            timestamp: eightDaysAgo
        });

        // Write recent event
        await fs.writeEvent({
            type: 'BOOT',
            timestamp: threeDaysAgo
        });

        // Trigger rotation
        await (fs as any).rotateIfNeeded();

        // Query all events
        const events = await fs.queryEvents(0, Date.now());

        // Should only have recent event
        expect(events.length).toBe(1);
        expect(events[0].timestamp).toBe(threeDaysAgo);
    });

    it('should rotate when size exceeds 10MB', async () => {
        // Create large events to exceed 10MB
        const largePayload = 'x'.repeat(1024 * 100); // 100KB per event
        const eventsToCreate = 120; // ~12MB total

        for (let i = 0; i < eventsToCreate; i++) {
            await fs.writeEvent({
                type: 'TICK',
                dt: 0.016,
                observation: {
                    timestamp: Date.now() + i,
                    delta_time: 16,
                    visibilty_state: 'visible',
                    heart_rate: 75
                },
                timestamp: Date.now() + i
            } as any);
        }

        // Trigger rotation
        await (fs as any).rotateIfNeeded();

        // Check size is under limit
        const size = await (fs as any).getLogSize();
        expect(size).toBeLessThan(10 * 1024 * 1024);
    });

    it('should preserve data integrity after rotation', async () => {
        const testEvent: KernelEvent = {
            type: 'START_SESSION',
            timestamp: Date.now()
        };

        await fs.writeEvent(testEvent);
        await (fs as any).rotateIfNeeded();

        const events = await fs.queryEvents(0, Date.now());
        expect(events.length).toBe(1);
        expect(events[0].type).toBe('START_SESSION');
    });
});

describe('SecureBioFS - Passphrase Flow', () => {
    it('should encrypt with user passphrase', async () => {
        const fs = new SecureBioFS();
        await fs.init('my-secure-passphrase');

        const event: KernelEvent = {
            type: 'BOOT',
            timestamp: Date.now()
        };

        await fs.writeEvent(event);
        const events = await fs.queryEvents(0, Date.now());

        expect(events.length).toBe(1);
        expect(events[0].type).toBe('BOOT');
    });

    it('should fail decryption with wrong passphrase', async () => {
        const fs1 = new SecureBioFS();
        await fs1.init('correct-passphrase');

        await fs1.writeEvent({
            type: 'BOOT',
            timestamp: Date.now()
        });

        // Try to read with different passphrase
        const fs2 = new SecureBioFS();
        await fs2.init('wrong-passphrase');

        const events = await fs2.queryEvents(0, Date.now());

        // Should fail to decrypt (empty or error)
        expect(events.length).toBe(0);
    });

    it('should require a passphrase', async () => {
        const fs = new SecureBioFS();
        await expect(fs.init()).rejects.toThrow('SecureBioFS requires a passphrase');
    });
});
