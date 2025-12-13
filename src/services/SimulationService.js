import { useState, useEffect } from 'react';
import { mockDevices } from '../utils/mockData';

export const useSimulation = (enabled = true, refreshRate = 5) => {
    const [devices, setDevices] = useState(mockDevices);
    // Keep a ref to the latest devices to avoid stale closures in intervals if we were using a simple interval
    // But here we will just update state based on previous state

    useEffect(() => {
        if (!enabled) return;

        const intervalId = setInterval(() => {
            setDevices(prevDevices => 
                prevDevices.map(device => {
                    // Simulating changes
                    const shouldUpdate = Math.random() > 0.7; // 30% chance to update each device
                    if (!shouldUpdate) return device;

                    // Update Traffic
                    let newTraffic = device.traffic;
                    if (device.traffic && device.traffic.includes('Mbps')) {
                         const val = parseInt(device.traffic);
                         const change = Math.floor(Math.random() * 50) - 25;
                         newTraffic = Math.max(0, val + change) + ' Mbps';
                    } else if (device.traffic && device.traffic.includes('Gbps')) {
                         const val = parseFloat(device.traffic);
                         const change = (Math.random() * 0.5) - 0.25;
                         newTraffic = Math.max(0, (val + change).toFixed(1)) + ' Gbps';
                    }

                    // Update CPU/Memory if metrics exist (adding them if not)
                    const currentMetrics = device.metrics || {};
                    const newMetrics = {
                        cpu: Math.min(100, Math.max(0, (parseInt(currentMetrics.cpu || 45) + Math.floor(Math.random() * 10 - 5)))) + '%',
                        memory: Math.min(100, Math.max(0, (parseInt(currentMetrics.memory || 60) + Math.floor(Math.random() * 8 - 4)))) + '%',
                        traffic: newTraffic
                    };

                    // Random status change (very rare)
                    let newStatus = device.status;
                    if (Math.random() > 0.98) {
                        const statuses = ['online', 'online', 'online', 'warning', 'online']; 
                        newStatus = statuses[Math.floor(Math.random() * statuses.length)];
                    }

                    return {
                        ...device,
                        traffic: newTraffic,
                        status: newStatus,
                        metrics: newMetrics
                    };
                })
            );
        }, refreshRate * 1000);

        return () => clearInterval(intervalId);
    }, [enabled, refreshRate]);

    // Expose a way to update devices externally (e.g., from Import)
    const updateDevices = (newDevices) => {
        setDevices(newDevices);
    };

    return { devices, updateDevices };
};
