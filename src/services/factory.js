import { deviceApi as realDeviceApi } from './api/device';
import { deviceApi as mockDeviceApi } from './mock/device';

// Default to MOCK if not specified, or checks VITE_USE_MOCK
const useMock = import.meta.env.VITE_USE_MOCK !== 'false'; 

export const deviceService = useMock ? mockDeviceApi : realDeviceApi;
