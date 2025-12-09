/**
 * useDevices Hook
 * 
 * Provides device data with loading and error states.
 * Supports auto-refresh based on interval.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchDevices, fetchTopologyData } from '../services/api';

/**
 * Hook to fetch and manage device list data
 * @param {Object} options - Hook options
 * @param {number} options.refreshInterval - Auto-refresh interval in seconds (0 = disabled)
 * @returns {{devices: Device[], loading: boolean, error: Error|null, refresh: () => void}}
 */
export function useDevices({ refreshInterval = 0 } = {}) {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadDevices = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchDevices();
            setDevices(data);
        } catch (err) {
            setError(err);
            console.error('Failed to fetch devices:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDevices();

        // Set up auto-refresh if interval is specified
        if (refreshInterval > 0) {
            const intervalId = setInterval(loadDevices, refreshInterval * 1000);
            return () => clearInterval(intervalId);
        }
    }, [loadDevices, refreshInterval]);

    return { devices, loading, error, refresh: loadDevices };
}

/**
 * Hook to fetch and manage topology graph data
 * @param {Object} options - Hook options
 * @param {number} options.refreshInterval - Auto-refresh interval in seconds (0 = disabled)
 * @returns {{graphData: {nodes: Device[], links: Link[]}, loading: boolean, error: Error|null, refresh: () => void}}
 */
export function useTopology({ refreshInterval = 0 } = {}) {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadTopology = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchTopologyData();
            
            // Process nodes to add fixed positions based on hierarchy
            const processedNodes = data.nodes.map(device => {
                let fx = 0, fy = 0, fz = 0;
                
                // Tier 1: Cloud (top)
                if (device.type === 'cloud') {
                    fx = 0; fy = 300; fz = 0;
                }
                // Tier 2: Firewall
                else if (device.type === 'firewall') {
                    fx = 0; fy = 150; fz = 0;
                }
                // Tier 3: Core Switch
                else if (device.type === 'core-switch') {
                    fx = 0; fy = 0; fz = 0;
                }
                // Tier 4: Aggregation Switches
                else if (device.type.includes('agg')) {
                    const aggIndex = device.id.includes('1') ? -1 : 1;
                    fx = aggIndex * 150; fy = -150; fz = 0;
                }
                // Tier 5: Servers/DB
                else {
                    if (device.id.includes('web')) {
                        const webIndex = parseInt(device.id.replace(/\D/g, '')) || 1;
                        fx = -150 + (webIndex - 2) * 80;
                        fy = -300;
                        fz = (webIndex - 2) * 50;
                    } else {
                        const dbIndex = device.id.includes('master') ? 0 : (device.id.includes('slave') ? 1 : 2);
                        fx = 150 + (dbIndex - 1) * 80;
                        fy = -300;
                        fz = (dbIndex - 1) * 50;
                    }
                }

                return { ...device, fx, fy, fz };
            });

            setGraphData({ nodes: processedNodes, links: data.links });
        } catch (err) {
            setError(err);
            console.error('Failed to fetch topology:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTopology();

        if (refreshInterval > 0) {
            const intervalId = setInterval(loadTopology, refreshInterval * 1000);
            return () => clearInterval(intervalId);
        }
    }, [loadTopology, refreshInterval]);

    return { graphData, loading, error, refresh: loadTopology };
}

export default { useDevices, useTopology };
