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
    createCartOrder: (data) => api.request('/orders/cart', { method: 'POST', body: JSON.stringify(data) }),
    updateOrderStatus: (id, status) => api.request(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    getBill: (orderId) => api.request(`/orders/${orderId}/bill`)
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
    toast.innerHTML = `<i data-lucide="${icon}"></i><div style="flex:1">${message}</div>`;
    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ─── Bill Modal ─── */
export function showBillModal(billData) {
    const existing = document.getElementById('billModal');
    if (existing) existing.remove();

    const { orderId, ward, room, doctor, date, time, items, subtotal, discount, tax, total } = billData;

    const itemRows = items.map(it => `
        <tr style="border-bottom:1px solid #F1F5F9">
            <td style="padding:10px 14px;font-weight:500">${it.name}</td>
            <td style="padding:10px 14px;text-align:center">${it.quantity}</td>
            <td style="padding:10px 14px;text-align:right">₹${Number(it.unitPrice).toFixed(2)}</td>
            <td style="padding:10px 14px;text-align:right;color:#10B981">${it.discount > 0 ? it.discount + '%' : '—'}</td>
            <td style="padding:10px 14px;text-align:right;font-weight:600;color:#1E5E75">₹${Number(it.lineTotal).toFixed(2)}</td>
        </tr>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'billModal';
    modal.style.cssText = `position:fixed;inset:0;background:rgba(15,23,42,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;backdrop-filter:blur(6px);`;

    modal.innerHTML = `
        <div id="billContent" style="background:#fff;border-radius:20px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 32px 80px rgba(0,0,0,0.25)">
            <div style="background:linear-gradient(135deg,#1E5E75 0%,#2FB7B3 100%);padding:30px 36px;border-radius:20px 20px 0 0;color:white;position:relative">
                <button onclick="document.getElementById('billModal').remove()"
                    style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.2);border:none;color:white;border-radius:50%;width:34px;height:34px;cursor:pointer;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center">✕</button>
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
                    <div style="background:rgba(255,255,255,0.2);border-radius:12px;padding:12px">
                        <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                    </div>
                    <div>
                        <div style="font-size:1.5rem;font-weight:800;letter-spacing:-0.02em">MedTrack Invoice</div>
                        <div style="opacity:0.75;font-size:0.9rem">Hospital Pharmacy Dispensing Bill</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:0.875rem;opacity:0.9;background:rgba(0,0,0,0.12);padding:14px 16px;border-radius:12px">
                    <div><span style="opacity:0.7">Order ID</span><br><strong>${orderId}</strong></div>
                    <div><span style="opacity:0.7">Date & Time</span><br><strong>${date} ${time}</strong></div>
                    <div style="margin-top:8px"><span style="opacity:0.7">Ward</span><br><strong>${ward}</strong></div>
                    <div style="margin-top:8px"><span style="opacity:0.7">Room / Bed</span><br><strong>${room}</strong></div>
                    <div style="margin-top:8px"><span style="opacity:0.7">Requested By</span><br><strong>${doctor}</strong></div>
                </div>
            </div>

            <div style="padding:28px 36px">
                <h3 style="color:#1E5E75;font-size:0.95rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:14px;font-weight:700">Dispensed Medicines</h3>
                <div style="border-radius:12px;border:1px solid #E2E8F0;overflow:hidden">
                    <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
                        <thead>
                            <tr style="background:#F8FAFC">
                                <th style="padding:10px 14px;text-align:left;color:#64748B;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em">Medicine</th>
                                <th style="padding:10px 14px;text-align:center;color:#64748B;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em">Qty</th>
                                <th style="padding:10px 14px;text-align:right;color:#64748B;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em">Unit Price</th>
                                <th style="padding:10px 14px;text-align:right;color:#64748B;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em">Disc.</th>
                                <th style="padding:10px 14px;text-align:right;color:#64748B;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em">Total</th>
                            </tr>
                        </thead>
                        <tbody>${itemRows}</tbody>
                    </table>
                </div>

                <div style="margin-top:24px;padding-top:20px;border-top:2px dashed #E2E8F0">
                    <div style="display:flex;justify-content:flex-end">
                        <div style="min-width:280px">
                            <div style="display:flex;justify-content:space-between;padding:7px 0;color:#64748B;font-size:0.9rem">
                                <span>Subtotal</span><span>₹${Number(subtotal).toFixed(2)}</span>
                            </div>
                            ${discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:7px 0;color:#10B981;font-size:0.9rem">
                                <span>Discount</span><span>-₹${Number(discount).toFixed(2)}</span>
                            </div>` : ''}
                            ${tax > 0 ? `<div style="display:flex;justify-content:space-between;padding:7px 0;color:#64748B;font-size:0.9rem">
                                <span>GST (5%)</span><span>₹${Number(tax).toFixed(2)}</span>
                            </div>` : ''}
                            <div style="display:flex;justify-content:space-between;padding:12px 18px;background:linear-gradient(135deg,#1E5E75,#2FB7B3);border-radius:12px;color:white;font-weight:700;font-size:1.15rem;margin-top:10px">
                                <span>Grand Total</span><span>₹${Number(total).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top:20px;padding:14px 18px;background:#F0FDF4;border-radius:12px;border-left:4px solid #10B981;font-size:0.85rem;color:#065F46">
                    ✅ Auto-generated upon pharmacy approval. Retain for ward records.
                </div>

                <div style="display:flex;gap:12px;margin-top:24px;justify-content:flex-end">
                    <button onclick="document.getElementById('billModal').remove()"
                        style="padding:11px 26px;border:1px solid #E2E8F0;border-radius:10px;background:white;cursor:pointer;font-weight:600;color:#475569;font-size:0.9rem">
                        Close
                    </button>
                    <button onclick="window.printBill()"
                        style="padding:11px 26px;background:linear-gradient(135deg,#1E5E75,#2FB7B3);border:none;border-radius:10px;color:white;cursor:pointer;font-weight:600;font-size:0.9rem;display:flex;align-items:center;gap:8px">
                        🖨️ Print Bill
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

window.printBill = () => {
    const content = document.getElementById('billContent');
    if (!content) return;
    const printWin = window.open('', '_blank');
    printWin.document.write(`
        <html><head><title>MedTrack Invoice</title>
        <style>
            body{font-family:Arial,sans-serif;padding:0;margin:0;background:#fff}
            button{display:none!important}
        </style>
        </head><body>${content.outerHTML}</body></html>
    `);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 400);
};