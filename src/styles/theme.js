/**
 * Theme Configuration
 * 
 * Centralized theme tokens for consistent styling across the application.
 * Supports both dark and light themes.
 */

export const themes = {
    dark: {
        name: 'dark',
        colors: {
            // Primary
            primary: '#1677ff',
            primaryHover: '#4096ff',
            
            // Background
            bgPrimary: '#000005',
            bgSecondary: '#0a0f14',
            bgTertiary: '#141920',
            bgCard: 'rgba(0, 10, 20, 0.8)',
            bgGlass: 'rgba(0, 10, 20, 0.75)',
            
            // Text
            textPrimary: 'rgba(255, 255, 255, 0.95)',
            textSecondary: 'rgba(255, 255, 255, 0.65)',
            textTertiary: 'rgba(255, 255, 255, 0.45)',
            
            // Borders
            border: 'rgba(100, 150, 255, 0.2)',
            borderHover: 'rgba(100, 150, 255, 0.4)',
            
            // Status
            success: '#52c41a',
            warning: '#faad14',
            error: '#ff4d4f',
            info: '#1677ff',
            
            // Device Status
            statusOnline: '#1da57a',
            statusOffline: '#ff4d4f',
            
            // 3D Elements  
            link: '#1677ff',
            linkParticle: '#52c41a',
            nodeGlow: '#1677ff33'
        },
        shadows: {
            card: '0 8px 32px rgba(0, 0, 0, 0.4)',
            glow: '0 0 20px rgba(22, 119, 255, 0.3)',
            text: '0 2px 4px rgba(0, 0, 0, 0.8)'
        },
        blur: {
            glass: 'blur(12px)'
        }
    },
    
    light: {
        name: 'light',
        colors: {
            // Primary
            primary: '#1677ff',
            primaryHover: '#4096ff',
            
            // Background
            bgPrimary: '#f0f2f5',
            bgSecondary: '#ffffff',
            bgTertiary: '#fafafa',
            bgCard: 'rgba(255, 255, 255, 0.95)',
            bgGlass: 'rgba(255, 255, 255, 0.85)',
            
            // Text
            textPrimary: 'rgba(0, 0, 0, 0.88)',
            textSecondary: 'rgba(0, 0, 0, 0.65)',
            textTertiary: 'rgba(0, 0, 0, 0.45)',
            
            // Borders
            border: 'rgba(0, 0, 0, 0.1)',
            borderHover: 'rgba(0, 0, 0, 0.2)',
            
            // Status
            success: '#52c41a',
            warning: '#faad14',
            error: '#ff4d4f',
            info: '#1677ff',
            
            // Device Status
            statusOnline: '#1da57a',
            statusOffline: '#ff4d4f',
            
            // 3D Elements  
            link: '#999',
            linkParticle: '#1677ff',
            nodeGlow: '#1677ff22'
        },
        shadows: {
            card: '0 2px 8px rgba(0, 0, 0, 0.08)',
            glow: '0 0 10px rgba(22, 119, 255, 0.15)',
            text: '0 1px 2px rgba(255, 255, 255, 0.8)'
        },
        blur: {
            glass: 'blur(8px)'
        }
    }
};

// Design Tokens
export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48
};

export const borderRadius = {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: '50%'
};

export const typography = {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 20,
        xxl: 24, 
        title: 28
    },
    fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700
    }
};

/**
 * Get theme by name
 * @param {'dark' | 'light'} themeName
 * @returns {typeof themes.dark}
 */
export function getTheme(themeName = 'dark') {
    return themes[themeName] || themes.dark;
}

export default { themes, spacing, borderRadius, typography, getTheme };
