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
    verifyLogin: (email, otp) => api.post('/auth/verify-login', { email, otp }),
    resendOtp: (email) => api.post('/auth/resend-otp', { email }),
    requestCmsOtp: (email) => api.post('/auth/request-cms-otp', { email }),
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
    create: (formData, otpCode) => api.post('/properties', formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...(otpCode && { 'X-OTP-Code': otpCode }) },
    }),
    update: (id, data, otpCode) => api.put(`/properties/${id}`, data, { headers: { 'X-OTP-Code': otpCode } }),
    approve: (id, status, otpCode) => api.put(`/properties/${id}/approve`, { status }, { headers: { 'X-OTP-Code': otpCode } }),
    delete: (id, otpCode) => api.delete(`/properties/${id}`, { headers: { 'X-OTP-Code': otpCode } }),
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

export const cmsAPI = {
    // Projects
    listProjects: () => api.get('/cms/projects'),
    createProject: (data, otpCode) => api.post('/cms/projects', data, { headers: { 'Content-Type': 'multipart/form-data', ...(otpCode && { 'X-OTP-Code': otpCode }) } }),
    updateProject: (id, data, otpCode) => api.put(`/cms/projects/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data', ...(otpCode && { 'X-OTP-Code': otpCode }) } }),
    deleteProject: (id, otpCode) => api.delete(`/cms/projects/${id}`, { headers: { ...(otpCode && { 'X-OTP-Code': otpCode }) } }),

    // Team
    listTeam: () => api.get('/cms/team'),
    createTeamMember: (data, otpCode) => api.post('/cms/team', data, { headers: { 'Content-Type': 'multipart/form-data', ...(otpCode && { 'X-OTP-Code': otpCode }) } }),
    updateTeamMember: (id, data, otpCode) => api.put(`/cms/team/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data', ...(otpCode && { 'X-OTP-Code': otpCode }) } }),
    deleteTeamMember: (id, otpCode) => api.delete(`/cms/team/${id}`, { headers: { ...(otpCode && { 'X-OTP-Code': otpCode }) } }),

    // Testimonials
    listTestimonials: () => api.get('/cms/testimonials'),
    createTestimonial: (data, otpCode) => api.post('/cms/testimonials', data, { headers: { 'Content-Type': 'multipart/form-data', ...(otpCode && { 'X-OTP-Code': otpCode }) } }),
    updateTestimonial: (id, data, otpCode) => api.put(`/cms/testimonials/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data', ...(otpCode && { 'X-OTP-Code': otpCode }) } }),
    deleteTestimonial: (id, otpCode) => api.delete(`/cms/testimonials/${id}`, { headers: { ...(otpCode && { 'X-OTP-Code': otpCode }) } }),
};

export default api;
