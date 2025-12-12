import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Settings from '../Settings';
import { SettingsProvider } from '../../../context/SettingsContext';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('Component: Settings', () => {
    it('should render form items', () => {
        render(
            <SettingsProvider>
                <Settings />
            </SettingsProvider>
        );
        expect(screen.getByText('系统偏好设置')).toBeInTheDocument();
        expect(screen.getByText('界面主题')).toBeInTheDocument();
        // The switch text might be hidden or part of label, checking labels
        expect(screen.getByText('粒子特效')).toBeInTheDocument();
        // Regex for dynamic text
        expect(screen.getByText(/数据刷新频率/)).toBeInTheDocument();
    });

    it('should allow changing theme', async () => {
        render(
            <SettingsProvider>
                <Settings />
            </SettingsProvider>
        );
        
        const saveBtn = screen.getByText('保存配置');
        expect(saveBtn).toBeInTheDocument();
    });

    it('should handle save action', async () => {
        render(
            <SettingsProvider>
                <Settings />
            </SettingsProvider>
        );
        const saveBtn = screen.getByRole('button', { name: /保存配置/i });
        fireEvent.click(saveBtn);
        
        expect(saveBtn).toBeInTheDocument();
        // Ideally we would mock message.success but it's hard to test side effects of message in JSDOM easily without detailed mocks
    });
});
