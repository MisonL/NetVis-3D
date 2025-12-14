import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DeviceList from '../DeviceList';
import { useSimulation } from '../../../services/SimulationService';
import { SettingsProvider } from '../../../context/SettingsContext';

// Mock hook
vi.mock('../../../services/SimulationService');

describe('Component: DeviceList', () => {
    it('should render device list', () => {
        const mockDevices = [
            { id: '1', label: 'Test Device 1', ip: '1.1.1.1', type: 'server', status: 'online', location: 'Lab' },
            { id: '2', label: 'Test Device 2', ip: '2.2.2.2', type: 'switch', status: 'offline', location: 'Lab' }
        ];
        useSimulation.mockReturnValue({ devices: mockDevices });
        
        render(
            <SettingsProvider>
                <DeviceList />
            </SettingsProvider>
        );
        expect(screen.getByText('数据中心设备资产清单 (实时)')).toBeInTheDocument();
        expect(screen.getByText('Test Device 1')).toBeInTheDocument();
        expect(screen.getByText('Test Device 2')).toBeInTheDocument();
        expect(screen.getByText('1.1.1.1')).toBeInTheDocument();
    });

    it('should filter devices on search', () => {
         const mockDevices = [
            { id: '1', label: 'Alpha Server', ip: '1.1.1.1', type: 'server', status: 'online' },
            { id: '2', label: 'Beta Switch', ip: '2.2.2.2', type: 'switch', status: 'online' }
        ];
        useSimulation.mockReturnValue({ devices: mockDevices });

        render(
            <SettingsProvider>
                <DeviceList />
            </SettingsProvider>
        );
        const input = screen.getByPlaceholderText('搜索设备名称或 IP...');
        
        // Search 'Alpha'
        fireEvent.change(input, { target: { value: 'Alpha' } });
        expect(screen.getByText('Alpha Server')).toBeInTheDocument();
        expect(screen.queryByText('Beta Switch')).not.toBeInTheDocument();
    });
});
