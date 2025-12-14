import { http } from '../http';

export const deviceApi = {
    getAll: () => http.get('/devices'),
    getById: (id) => http.get(`/devices/${id}`),
    create: (data) => http.post('/devices', data),
    update: (id, data) => http.request(`/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => http.request(`/devices/${id}`, { method: 'DELETE' }),
};
