export const api = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('medtrack_token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };
        try {
            const res = await fetch(`/api${endpoint}`, { ...options, headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Server error');
            return data;
        } catch (e) {
            console.error('API Error:', e);
            throw e;
        }
    },

    // Auth
    login: (credentials) => api.request('/login', { method: 'POST', body: JSON.stringify(credentials) }),

    // Medicines
    getMedicines: () => api.request('/medicines'),
    addMedicine: (data) => api.request('/medicines', { method: 'POST', body: JSON.stringify(data) }),
    updateMedicine: (id, data) => api.request(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteMedicine: (id) => api.request(`/medicines/${id}`, { method: 'DELETE' }),
    reduceStock: (id, quantity) => api.request(`/medicines/${id}/reduce`, { method: 'POST', body: JSON.stringify({ quantity }) }),

    // Patients
    getPatients: () => api.request('/patients'),
    addPatient: (data) => api.request('/patients', { method: 'POST', body: JSON.stringify(data) }),
    updatePatient: (id, data) => api.request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePatient: (id) => api.request(`/patients/${id}`, { method: 'DELETE' }),
    assignMedicine: (data) => api.request('/assign', { method: 'POST', body: JSON.stringify(data) }),

    // Dashboard & Analytics
    getDashboard: () => api.request('/dashboard'),
    getAnalyticsSummary: () => api.request('/analytics/summary'),
    getMedicineSales: () => api.request('/analytics/medicine-sales'),

    // Orders
    getOrders: () => api.request('/orders'),
    createOrder: (data) => api.request('/orders', { method: 'POST', body: JSON.stringify(data) }),
    updateOrderStatus: (id, status) => api.request(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })
};

export function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = type === 'success' ? 'check-circle' : 'alert-circle';

    toast.innerHTML = `
        <i data-lucide="${icon}"></i>
        <div style="flex: 1">${message}</div>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
