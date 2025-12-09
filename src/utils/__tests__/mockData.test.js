
import { describe, it, expect } from 'vitest';
import { mockDevices, mockLinks, getDeviceDetails } from '../../utils/mockData';

describe('Logic Layer: Mock Data', () => {
    it('should have devices array with correct structure', () => {
        expect(Array.isArray(mockDevices)).toBe(true);
        expect(mockDevices.length).toBeGreaterThan(0);
        
        const device = mockDevices[0];
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('type');
        expect(device).toHaveProperty('label');
        expect(device).toHaveProperty('ip');
        expect(device).toHaveProperty('status');
        expect(device).toHaveProperty('location');
    });

    it('should have links array with correct structure', () => {
        expect(Array.isArray(mockLinks)).toBe(true);
        expect(mockLinks.length).toBeGreaterThan(0);

        const link = mockLinks[0];
        expect(link).toHaveProperty('source');
        expect(link).toHaveProperty('target');
        expect(link).toHaveProperty('traffic');
    });

    it('getDeviceDetails should return correct device', async () => {
        const targetId = mockDevices[0].id;
        const device = await getDeviceDetails(targetId);
        expect(device).toBeDefined();
        expect(device.id).toBe(targetId);
    });

    it('getDeviceDetails should return undefined for non-existent ID', async () => {
        const device = await getDeviceDetails('non-existent-id');
        expect(device).toBeUndefined();
    });
});
