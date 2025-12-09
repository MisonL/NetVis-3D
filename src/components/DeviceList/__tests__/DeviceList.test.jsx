
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DeviceList from '../DeviceList';
import { useDevices } from '../../../hooks/useDevices';

// Mock hook
vi.mock('../../../hooks/useDevices');

describe('Component: DeviceList', () => {
    it('should render loading state', () => {
        useDevices.mockReturnValue({ devices: [], loading: true, error: null, refresh: vi.fn() });
        render(<DeviceList />);
        // Antd table loading shows a spinner, or check for skeleton if implemented
        // Here we check if table structure exists or specific loading text
        // AntD Table loading is inside the table body. Simplified check: render without crashing
        expect(screen.getByText('设备清单')).toBeInTheDocument();
    });

    it('should render device list', () => {
        const mockDevices = [
            { id: '1', label: 'Test Device 1', ip: '1.1.1.1', type: 'server', status: 'online', location: 'Lab' },
            { id: '2', label: 'Test Device 2', ip: '2.2.2.2', type: 'switch', status: 'offline', location: 'Lab' }
        ];
        useDevices.mockReturnValue({ devices: mockDevices, loading: false, error: null, refresh: vi.fn() });
        
        render(<DeviceList />);
        expect(screen.getByText('Test Device 1')).toBeInTheDocument();
        expect(screen.getByText('Test Device 2')).toBeInTheDocument();
        expect(screen.getByText('1.1.1.1')).toBeInTheDocument();
    });

    it('should filter devices on search', () => {
         const mockDevices = [
            { id: '1', label: 'Alpha Server', ip: '1.1.1.1', type: 'server', status: 'online' },
            { id: '2', label: 'Beta Switch', ip: '2.2.2.2', type: 'switch', status: 'online' }
        ];
        useDevices.mockReturnValue({ devices: mockDevices, loading: false, error: null, refresh: vi.fn() });

        render(<DeviceList />);
        const input = screen.getByPlaceholderText('搜索设备名称或 IP...');
        
        // Search 'Alpha'
        fireEvent.change(input, { target: { value: 'Alpha' } });
        expect(screen.getByText('Alpha Server')).toBeInTheDocument();
        expect(screen.queryByText('Beta Switch')).not.toBeInTheDocument();
    });
});
