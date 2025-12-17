import { useState, useEffect, useCallback } from 'react';
import { http } from '../services/http';

export const useDevices = (refreshRate = 10) => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchDevices = useCallback(async () => {
        try {
            // Fetch up to 1000 devices to simulate "all" for client-side table handling
            // In a real production app, we would implement server-side pagination in the Table component
            const response = await http.get('/devices?pageSize=1000');
            // Check response structure. Based on standardized API, it should be { code: 0, data: { list: [], total: ... } }
            if (response && response.code === 0 && response.data) {
                 const list = response.data.list || response.data; // Handle both paginated ({list: []}) and straight array
                 if (Array.isArray(list)) {
                     const mapped = list.map(d => ({
                         ...d,
                         label: d.name, // Map name to label
                         ip: d.ipAddress, // Map ipAddress to ip
                         // Ensure metrics object exists
                         metrics: d.metrics || { cpu: 0, memory: 0 } 
                     }));
                     setDevices(mapped);
                     setError(null);
                 }
            }
        } catch (err) {
            console.error('Failed to fetch devices:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateDevices = useCallback((newDevices) => {
        // Optimistic update or call API to update? 
        // For now, this is used in DeviceList to partial update. 
        // Ideally we should assume this triggers a re-fetch or we implement specific update methods.
        // But to keep interface compatible with useSimulation, we just set state.
        setDevices(newDevices);
    }, []);

    useEffect(() => {
        fetchDevices();
        if (refreshRate > 0) {
            const interval = setInterval(fetchDevices, refreshRate * 1000);
            return () => clearInterval(interval);
        }
    }, [fetchDevices, refreshRate]);

    return { devices, updateDevices, loading, error, refresh: fetchDevices };
};
