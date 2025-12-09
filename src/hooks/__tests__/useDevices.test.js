
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useDevices } from '../useDevices';

// Mock the API service
vi.mock('../../services/api', () => ({
    fetchDevices: vi.fn(() => Promise.resolve([
        { id: 'dev1', label: 'Device 1', ip: '1.2.3.4' },
        { id: 'dev2', label: 'Device 2', ip: '5.6.7.8' }
    ])),
    fetchTopologyData: vi.fn()
}));

describe('Logic Layer: useDevices Hook', () => {
    it('should return loading initially and then data', async () => {
        const { result } = renderHook(() => useDevices());

        // Initially loading
        expect(result.current.loading).toBe(true);
        expect(result.current.devices).toEqual([]);
        expect(result.current.error).toBeNull();

        // Wait for update
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Check data
        expect(result.current.devices.length).toBe(2);
        expect(result.current.devices[0].label).toBe('Device 1');
    });
});
