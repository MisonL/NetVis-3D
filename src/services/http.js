/**
 * HTTP Client Client
 * Wrapper around native fetch with interceptors support
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class HttpClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        const config = {
            ...options,
            headers,
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                // Handle 401/403 here commonly
                throw new Error(`HTTP Error: ${response.status}`);
            }

            // Assume JSON response
            return await response.json();
        } catch (error) {
            console.error('API Request Failed:', error);
            throw error;
        }
    }

    get(endpoint, options) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    post(endpoint, data, options) {
        return this.request(endpoint, { 
            ...options, 
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
}

export const http = new HttpClient(BASE_URL);
