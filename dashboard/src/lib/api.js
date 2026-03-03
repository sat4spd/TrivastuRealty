import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: { 'Content-Type': 'application/json' },
});

// Attach token to requests
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('trivastu_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('trivastu_token');
            localStorage.removeItem('trivastu_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const authAPI = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    setup: (email, password, name) => api.post('/auth/setup', { email, password, name }),
};

export const agentsAPI = {
    list: (params) => api.get('/agents', { params }),
    get: (id) => api.get(`/agents/${id}`),
    create: (data) => api.post('/agents', data),
    update: (id, data) => api.put(`/agents/${id}`, data),
    updateStatus: (id, status) => api.put(`/agents/${id}/status`, { status }),
};

export const propertiesAPI = {
    list: (params) => api.get('/properties', { params }),
    get: (id) => api.get(`/properties/${id}`),
    create: (formData) => api.post('/properties', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    update: (id, data) => api.put(`/properties/${id}`, data),
    approve: (id, status) => api.put(`/properties/${id}/approve`, { status }),
    delete: (id) => api.delete(`/properties/${id}`),
};

export const leadsAPI = {
    list: (params) => api.get('/leads', { params }),
    get: (id) => api.get(`/leads/${id}`),
    updateStatus: (id, status, data = {}) => api.put(`/leads/${id}/status`, { status, ...data }),
    assign: (id, agentId) => api.put(`/leads/${id}/assign`, { agentId }),
};

export const broadcastAPI = {
    send: (data) => api.post('/broadcast/send', data),
    logs: (params) => api.get('/broadcast/logs', { params }),
};

export const analyticsAPI = {
    overview: () => api.get('/analytics/overview'),
    leads: () => api.get('/analytics/leads'),
    agents: () => api.get('/analytics/agents'),
    properties: () => api.get('/analytics/properties'),
    broadcasts: () => api.get('/analytics/broadcasts'),
};

export const groupsAPI = {
    list: () => api.get('/groups'),
    get: (id) => api.get(`/groups/${id}`),
    create: (data) => api.post('/groups/create', data),
    join: (id) => api.post(`/groups/${id}/join`),
};

export const documentsAPI = {
    upload: (formData) => api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    getUrl: (key) => api.get(`/documents/${key}/url`),
};

export default api;
