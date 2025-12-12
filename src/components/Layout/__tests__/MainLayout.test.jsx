
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MainLayout from '../MainLayout';
import { SettingsProvider } from '../../../context/SettingsContext';

// Mock child components to isolate layout testing
vi.mock('../../Topology/TopologyCanvas3D', () => ({
    default: ({ bgMode }) => <div data-testid="topo-3d">3D Canvas (Theme: {bgMode})</div>
}));
vi.mock('../../Topology/TopologyCanvas', () => ({
    default: () => <div data-testid="topo-2d">2D Canvas</div>
}));
vi.mock('../../DeviceList/DeviceList', () => ({
    default: () => <div data-testid="device-list">Device List Component</div>
}));
vi.mock('../../Settings/Settings', () => ({
    default: () => <div data-testid="settings">Settings Component</div>
}));
vi.mock('../../Dashboard/Dashboard', () => ({
    default: () => <div data-testid="dashboard">Dashboard Component</div>
}));

// Mock react-transition-group to avoid JSDOM issues
vi.mock('react-transition-group', () => ({
    CSSTransition: ({ children }) => <div>{children}</div>,
    SwitchTransition: ({ children }) => <div>{children}</div>,
}));

// Mock matchMedia for Layout Sider
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('Component: MainLayout', () => {
    it('should render dashboard by default', () => {
        render(
            <SettingsProvider>
                <MainLayout />
            </SettingsProvider>
        );
        expect(screen.getByText('NETVIS PRO')).toBeInTheDocument();
        // Initial view is Dashboard
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });

    it('should navigate to 3D Topology', () => {
        render(
            <SettingsProvider>
                <MainLayout />
            </SettingsProvider>
        );
        const menuTopo = screen.getByText('3D 拓扑视图');
        fireEvent.click(menuTopo);
        expect(screen.getByTestId('topo-3d')).toBeInTheDocument();
    });

    it('should navigate to Device List', () => {
        render(
            <SettingsProvider>
                <MainLayout />
            </SettingsProvider>
        );
        const menuDevice = screen.getByText('设备列表');
        fireEvent.click(menuDevice);
        expect(screen.getByTestId('device-list')).toBeInTheDocument();
    });

    it('should navigate to Settings', () => {
        render(
            <SettingsProvider>
                <MainLayout />
            </SettingsProvider>
        );
        const menuSettings = screen.getByText('系统设置');
        fireEvent.click(menuSettings);
        expect(screen.getByTestId('settings')).toBeInTheDocument();
    });
});
