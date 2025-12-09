/**
 * API Service Layer
 * 
 * Provides centralized data fetching with support for:
 * - Mock data mode (for development)
 * - Real API mode (for production)
 */

import { mockDevices, mockLinks } from '../utils/mockData';

// Configuration from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

/**
 * Generic fetch wrapper with error handling
 * @param {string} endpoint - API endpoint
 * @returns {Promise<any>} - Response data
 */
async function fetchAPI(endpoint) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

/**
 * Fetch all devices
 * @returns {Promise<Device[]>} - Array of devices
 */
export async function fetchDevices() {
    if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300));
        return mockDevices;
    }
    return fetchAPI('/devices');
}

/**
 * Fetch a single device by ID
 * @param {string} id - Device ID
 * @returns {Promise<Device | null>} - Device or null
 */
export async function fetchDeviceById(id) {
    if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return mockDevices.find(d => d.id === id) || null;
    }
    return fetchAPI(`/devices/${id}`);
}

/**
 * Fetch topology data (nodes and links)
 * @returns {Promise<{nodes: Device[], links: Link[]}>} - Graph data
 */
export async function fetchTopologyData() {
    if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return {
            nodes: mockDevices,
            links: mockLinks
        };
    }
    return fetchAPI('/topology');
}

/**
 * Check API health
 * @returns {Promise<boolean>} - True if API is reachable
 */
export async function checkAPIHealth() {
    if (USE_MOCK_DATA) {
        return true;
    }
    try {
        await fetchAPI('/health');
        return true;
    } catch {
        return false;
    }
}

export default {
    fetchDevices,
    fetchDeviceById,
    fetchTopologyData,
    checkAPIHealth,
    API_BASE_URL,
    USE_MOCK_DATA
};
