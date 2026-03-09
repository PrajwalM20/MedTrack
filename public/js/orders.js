import { api, showToast } from './api.js';
import { auth, renderSidebar, renderTopbar } from './auth.js';

let allOrders = [];
let userRole = null;

document.addEventListener('DOMContentLoaded', async () => {
    const authStatus = auth.checkAuth();
    if (!authStatus.authenticated) return;
    userRole = authStatus.role;

    document.getElementById('sidebar-container').innerHTML = renderSidebar('orders');
    document.getElementById('topbar-container').innerHTML = renderTopbar();
    if (window.lucide) window.lucide.createIcons();

    await loadOrders();

    document.getElementById('search-input').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = allOrders.filter(o =>
            o.medicineName.toLowerCase().includes(q) ||
            o.id.toLowerCase().includes(q) ||
            o.ward.toLowerCase().includes(q)
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
    if (st === 'Pending') return 'badge-pending';
    if (st === 'Processing') return 'badge-processing';
    return 'badge-delivered';
}

function renderTable(list) {
    const tbody = document.getElementById('table-body');
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:40px; color:#888;">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(o => {
        let actionHtml = '';

        if (userRole === 'admin') {
            actionHtml = `
                <td class="text-right">
                    <select onchange="updateStatus('${o.id}', this.value)" style="padding: 6px; font-size: 0.85rem; border: 1px solid var(--border-color); border-radius: 6px;" ${o.status === 'Delivered' ? 'disabled' : ''}>
                        <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
                        <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                    </select>
                </td>
            `;
        } else {
            actionHtml = `<td class="text-right"><span class="badge ${getStatusBadge(o.status)}">${o.status}</span></td>`;
        }

        return `
            <tr>
                <td><strong>${o.id}</strong><br><span class="td-subtitle">${o.date} ${o.time}</span></td>
                <td><span style="font-weight:500; color:var(--text-main)">${o.medicineName}</span></td>
                <td>${o.quantity} units</td>
                <td>Ward: ${o.ward}<br><span class="td-subtitle">Rm. ${o.room}</span></td>
                <td><span class="badge ${getStatusBadge(o.status)}">${o.status}</span></td>
                ${actionHtml}
            </tr>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

window.updateStatus = async (id, status) => {
    try {
        await api.updateOrderStatus(id, status);
        showToast('Status updated to ' + status);
        loadOrders();
    } catch {
        showToast('Failed to update status', 'error');
    }
};
