import { useState, useEffect, useCallback } from 'react';
import { http } from '../services/http';

export const useTopologyData = (refreshRate = 10) => {
    const [data, setData] = useState({ nodes: [], edges: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            // using http.get
            const response = await http.get('/topology-manage/graph');
            if (response && response.code === 0 && response.data) {
                 setData({
                    nodes: response.data.nodes || [],
                    edges: response.data.edges || [],
                    stats: response.data.stats || {}
                });
                setError(null);
            }
        } catch (err) {
            console.error('Failed to fetch topology data:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(); // Initial fetch

        if (refreshRate > 0) {
            const interval = setInterval(fetchData, refreshRate * 1000);
            return () => clearInterval(interval);
        }
    }, [fetchData, refreshRate]);

    return { ...data, loading, error, refresh: fetchData };
};
