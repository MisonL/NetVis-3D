import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { locales, defaultLocale, supportedLocales, localeNames } from '../locales';

const I18nContext = createContext(null);

export const I18nProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(() => {
    const saved = localStorage.getItem('locale');
    return saved && supportedLocales.includes(saved) ? saved : defaultLocale;
  });

  const setLocale = useCallback((newLocale) => {
    if (supportedLocales.includes(newLocale)) {
      setLocaleState(newLocale);
      localStorage.setItem('locale', newLocale);
      document.documentElement.lang = newLocale;
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((key, params = {}) => {
    const keys = key.split('.');
    let value = locales[locale];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to default locale
        value = locales[defaultLocale];
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key; // Return key if not found
          }
        }
        break;
      }
    }

    // Replace params
    if (typeof value === 'string' && Object.keys(params).length > 0) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => params[paramKey] || `{${paramKey}}`);
    }

    return typeof value === 'string' ? value : key;
  }, [locale]);

  const toggleLocale = useCallback(() => {
    const currentIndex = supportedLocales.indexOf(locale);
    const nextIndex = (currentIndex + 1) % supportedLocales.length;
    setLocale(supportedLocales[nextIndex]);
  }, [locale, setLocale]);

  const value = {
    locale,
    setLocale,
    t,
    toggleLocale,
    supportedLocales,
    localeNames,
    isZh: locale === 'zh-CN',
    isEn: locale === 'en-US',
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

export default I18nContext;
