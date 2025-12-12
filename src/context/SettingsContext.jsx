/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useContext } from 'react';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

const STORAGE_KEYS = {
    THEME: 'netvis_theme',
    BG_MODE: 'netvis_topology_bgMode',
    SOLID_BG_COLOR: 'netvis_solidBgColor',
    ICON_THEME: 'netvis_topology_iconTheme',
    SHOW_LABELS: 'netvis_topology_showLabels',
    PARTICLE_EFFECTS: 'netvis_particleEffects', 
    AUTO_ROTATE: 'netvis_autoRotate',
    REFRESH_RATE: 'netvis_refreshRate',
    TEXTURE_QUALITY: 'netvis_textureQuality',
    BLOOM_ENABLED: 'netvis_bloomEnabled',
    BLOOM_INTENSITY: 'netvis_bloomIntensity'
};

export const SettingsProvider = ({ children }) => {

    const [settings, setSettings] = useState(() => ({
        theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark',
        bgMode: localStorage.getItem(STORAGE_KEYS.BG_MODE) || 'starfield',
        solidBgColor: localStorage.getItem(STORAGE_KEYS.SOLID_BG_COLOR) || '#1a1a2e',
        iconTheme: localStorage.getItem(STORAGE_KEYS.ICON_THEME) || 'premium',
        showLabels: localStorage.getItem(STORAGE_KEYS.SHOW_LABELS) !== 'false',
        particleEffects: localStorage.getItem(STORAGE_KEYS.PARTICLE_EFFECTS) !== 'false',
        autoRotate: localStorage.getItem(STORAGE_KEYS.AUTO_ROTATE) === 'true',
        refreshRate: parseInt(localStorage.getItem(STORAGE_KEYS.REFRESH_RATE) || 5),
        textureQuality: localStorage.getItem(STORAGE_KEYS.TEXTURE_QUALITY) || 'high',
        bloomEnabled: localStorage.getItem(STORAGE_KEYS.BLOOM_ENABLED) === 'true',
        bloomIntensity: parseFloat(localStorage.getItem(STORAGE_KEYS.BLOOM_INTENSITY) || 0.6),
    }));

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.THEME, settings.theme);
        localStorage.setItem(STORAGE_KEYS.BG_MODE, settings.bgMode);
        localStorage.setItem(STORAGE_KEYS.SOLID_BG_COLOR, settings.solidBgColor);
        localStorage.setItem(STORAGE_KEYS.ICON_THEME, settings.iconTheme);
        localStorage.setItem(STORAGE_KEYS.SHOW_LABELS, settings.showLabels);
        localStorage.setItem(STORAGE_KEYS.PARTICLE_EFFECTS, settings.particleEffects);
        localStorage.setItem(STORAGE_KEYS.AUTO_ROTATE, settings.autoRotate);
        localStorage.setItem(STORAGE_KEYS.REFRESH_RATE, settings.refreshRate);
        localStorage.setItem(STORAGE_KEYS.TEXTURE_QUALITY, settings.textureQuality);
        localStorage.setItem(STORAGE_KEYS.BLOOM_ENABLED, settings.bloomEnabled);
        localStorage.setItem(STORAGE_KEYS.BLOOM_INTENSITY, settings.bloomIntensity);
    }, [settings]);

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSetting }}>
            {children}
        </SettingsContext.Provider>
    );
};
