import { mockDevices } from '../../utils/mockData';

export const deviceApi = {
    getAll: async () => {
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return [...mockDevices];
    },
    getById: async (id) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return mockDevices.find(d => d.id === id);
    },
    create: async (data) => {
        return { id: `mock-${Date.now()}`, ...data };
    },
    update: async (id, data) => {
        return { id, ...data };
    },
    delete: async () => {
        // console.log('Mock Delete:', id);
        return { success: true };
    }
};
