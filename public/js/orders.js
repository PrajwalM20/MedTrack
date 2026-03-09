import { api, showToast, showBillModal } from './api.js';
import { auth, renderSidebar, renderTopbar } from './auth.js';

let allOrders = [];
let userRole  = null;

document.addEventListener('DOMContentLoaded', async () => {
    const authStatus = auth.checkAuth();
    if (!authStatus.authenticated) return;
    userRole = authStatus.role;

    document.getElementById('sidebar-container').innerHTML = renderSidebar('orders');
    document.getElementById('topbar-container').innerHTML  = renderTopbar();
    if (window.lucide) window.lucide.createIcons();

    await loadOrders();

    document.getElementById('search-input').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = allOrders.filter(o =>
            (o.medicineName || '').toLowerCase().includes(q) ||
            o.id.toLowerCase().includes(q) ||
            (o.ward || '').toLowerCase().includes(q)
        );
        renderTable(filtered);
    });
});

async function loadOrders() {
    try {
        allOrders = await api.getOrders();
        renderTable(allOrders);
    } catch (e) {
        showToast('Failed to load orders', 'error');
    }
}

function getStatusBadge(st) {
    if (st === 'Pending')    return 'badge-pending';
    if (st === 'Processing') return 'badge-processing';
    return 'badge-delivered';
}

function renderTable(list) {
    const tbody = document.getElementById('table-body');
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:40px;color:#888">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(o => {
        // Support multi-item orders
        const medDisplay = o.items && o.items.length > 1
            ? `${o.items[0].medicineName} <span class="badge badge-info">+${o.items.length - 1} more</span>`
            : (o.medicineName || (o.items && o.items[0]?.medicineName) || '—');

        const qtyDisplay = o.items && o.items.length > 1
            ? o.items.reduce((s, i) => s + Number(i.quantity), 0) + ' total'
            : (o.quantity ? o.quantity + ' units' : '—');

        let actionHtml = '';
        if (userRole === 'admin') {
            actionHtml = `
                <td class="text-right" style="white-space:nowrap">
                    <select onchange="updateStatus('${o.id}', this.value)"
                        style="padding:6px 10px;font-size:0.85rem;border:1px solid var(--border-color);border-radius:8px;cursor:pointer;margin-right:6px"
                        ${o.status === 'Delivered' ? 'disabled' : ''}>
                        <option value="Pending"    ${o.status === 'Pending'    ? 'selected' : ''}>Pending</option>
                        <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
                        <option value="Delivered"  ${o.status === 'Delivered'  ? 'selected' : ''}>Delivered</option>
                    </select>
                    ${o.status === 'Delivered'
                        ? `<button onclick="viewBill('${o.id}')"
                               style="padding:6px 12px;background:linear-gradient(135deg,#1E5E75,#2FB7B3);border:none;border-radius:8px;color:white;cursor:pointer;font-size:0.82rem;font-weight:600">
                               🧾 Bill
                           </button>`
                        : ''}
                </td>
            `;
        } else {
            // Ward user: see status + bill button if delivered
            actionHtml = `
                <td class="text-right" style="white-space:nowrap">
                    <span class="badge ${getStatusBadge(o.status)}">${o.status}</span>
                    ${o.status === 'Delivered'
                        ? `<button onclick="viewBill('${o.id}')"
                               style="margin-left:8px;padding:6px 12px;background:linear-gradient(135deg,#1E5E75,#2FB7B3);border:none;border-radius:8px;color:white;cursor:pointer;font-size:0.82rem;font-weight:600">
                               🧾 View Bill
                           </button>`
                        : ''}
                </td>
            `;
        }

        return `
            <tr>
                <td>
                    <strong style="font-size:0.85rem">${o.id}</strong>
                    <br><span class="td-subtitle">${o.date || ''} ${o.time || ''}</span>
                </td>
                <td><span style="font-weight:500;color:var(--text-main)">${medDisplay}</span></td>
                <td>${qtyDisplay}</td>
                <td>Ward: ${o.ward || '—'}<br><span class="td-subtitle">Rm. ${o.room || '—'}</span></td>
                <td><span class="badge ${getStatusBadge(o.status)}">${o.status}</span></td>
                ${actionHtml}
            </tr>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

window.updateStatus = async (id, status) => {
    try {
        const result = await api.updateOrderStatus(id, status);
        showToast('Status updated to ' + status);
        // If just delivered, auto-show bill
        if (status === 'Delivered' && result && result.bill) {
            showBillModal(result.bill);
        }
        loadOrders();
    } catch { showToast('Failed to update status', 'error'); }
};

window.viewBill = async (id) => {
    try {
        const bill = await api.getBill(id);
        showBillModal(bill);
    } catch (e) {
        showToast('Could not load bill: ' + (e.message || 'Server error'), 'error');
    }
};