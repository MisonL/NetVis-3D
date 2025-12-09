
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MainLayout from '../MainLayout';

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
    it('should render main layout structure', () => {
        render(<MainLayout />);
        expect(screen.getByText('NetVis Platform')).toBeInTheDocument();
        expect(screen.getByText('3D 数据中心可视化平台')).toBeInTheDocument();
        // Initial view is 3D Topology
        expect(screen.getByTestId('topo-3d')).toBeInTheDocument();
    });

    it('should navigate to Device List', () => {
        render(<MainLayout />);
        const menuDevice = screen.getByText('设备列表');
        fireEvent.click(menuDevice);
        expect(screen.getByTestId('device-list')).toBeInTheDocument();
        expect(screen.queryByTestId('topo-3d')).not.toBeInTheDocument();
    });

    it('should navigate to Settings', () => {
        render(<MainLayout />);
        const menuSettings = screen.getByText('系统设置');
        fireEvent.click(menuSettings);
        expect(screen.getByTestId('settings')).toBeInTheDocument();
    });
});
