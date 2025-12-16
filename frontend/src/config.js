// Central Configuration
// All API URL definitions should come from here to ensure environment variables are respected.

export const API_BASE_URL = import.meta.env.VITE_API_URL || ''; // Default to relative if not set, or let proxy handle it
// If we really want a default:
// export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'; 
// But better to fail or use relative path in production if proxied.
// For this project structure, often dev is on 5173 and server on 3001.

export const getApiUrl = (path) => {
    const base = API_BASE_URL.replace(/\/$/, '');
    const endpoint = path.replace(/^\//, '');
    return `${base}/${endpoint}`;
};
