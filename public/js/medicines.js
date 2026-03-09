import { api, showToast } from './api.js';
import { auth, renderSidebar, renderTopbar } from './auth.js';

let allMedicines = [];
let userRole = null;

document.addEventListener('DOMContentLoaded', async () => {
    const authStatus = auth.checkAuth();
    if (!authStatus.authenticated) return;
    userRole = authStatus.role;

    document.getElementById('sidebar-container').innerHTML = renderSidebar('medicines');
    document.getElementById('topbar-container').innerHTML = renderTopbar();
    if (window.lucide) window.lucide.createIcons();

    if (userRole === 'admin') {
        document.getElementById('admin-actions').classList.remove('hidden');
    }

    await loadMedicines();

    document.getElementById('search-input').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = allMedicines.filter(m => m.name.toLowerCase().includes(q) || m.batch?.toLowerCase().includes(q));
        renderTable(filtered);
    });
});

async function loadMedicines() {
    try {
        allMedicines = await api.getMedicines();
        renderTable(allMedicines);
    } catch (e) {
        showToast('Failed to load medicines', 'error');
    }
}

function renderTable(list) {
    const tbody = document.getElementById('table-body');
    const today = new Date().toISOString().split('T')[0];

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:40px; color:#888;">No medicines found</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(m => {
        const isLow = m.quantity <= 10;
        const isExpired = m.expiry < today;

        let badges = '';
        if (isLow) badges += '<span class="badge badge-warning">Low Stock</span> ';
        if (isExpired) badges += '<span class="badge badge-danger">Expired</span> ';

        let additionalInfo = '';
        if (userRole === 'admin') {
            additionalInfo = `
                <td>
                    <div>₹${Number(m.finalPrice).toFixed(2)}</div>
                    ${m.discount > 0 ? `<span class="td-subtitle">₹${m.price} (-${m.discount}%)</span>` : ''}
                </td>
                <td class="text-right">
                    <button class="icon-btn text-danger" onclick="deleteMed('${m.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
                    <button class="icon-btn text-primary" onclick="editMed('${m.id}')" title="Edit"><i data-lucide="edit-2"></i></button>
                </td>
            `;
        } else {
            additionalInfo = `
                <td class="text-right">
                    <button class="btn btn-primary btn-sm" onclick="reqSupply('${m.id}')" ${m.quantity <= 0 ? 'disabled' : ''}>Request</button>
                </td>
            `;
        }

        return `
            <tr>
                <td><strong>${m.name}</strong> ${badges ? `<div class="mt-1">${badges}</div>` : ''}</td>
                <td>Batch: ${m.batch || '-'}</td>
                <td><span class="${isExpired ? 'text-danger' : ''}">${m.expiry}</span></td>
                <td><span style="font-weight:600; color:${isLow ? 'var(--color-red)' : 'inherit'}">${m.quantity}</span></td>
                ${additionalInfo}
            </tr>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

window.deleteMed = async (id) => {
    if (!confirm('Delete this medicine?')) return;
    try {
        await api.deleteMedicine(id);
        showToast('Medicine deleted');
        loadMedicines();
    } catch { showToast('Error deleting medicine', 'error'); }
};

window.reqSupply = async (id) => {
    const m = allMedicines.find(x => x.id === id);
    if (!m) return;
    const qty = prompt(`Request quantity for ${m.name}?`);
    if (!qty) return;

    const ward = prompt('Ward Name:') || 'Main';
    const room = prompt('Room/Bed No:') || 'N/A';

    try {
        const result = await api.createOrder({
            medicineId: m.id,
            medicineName: m.name,
            quantity: qty,
            ward,
            room,
            doctor: 'Ward User'
        });
        showToast(`Order sent successfully! Bill Generated: ₹${result.billAmount}`);
        loadMedicines();
    } catch { showToast('Failed to create order', 'error'); }
};

window.openMedPanel = () => {
    document.getElementById('m_id').value = '';
    document.getElementById('med-panel-title').innerText = 'Add New Medicine';
    ['m_name', 'm_batch', 'm_exp', 'm_qty', 'm_price', 'm_disc'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('med-panel').classList.remove('hidden');
};

window.closeMedPanel = () => {
    document.getElementById('med-panel').classList.add('hidden');
};

window.editMed = (id) => {
    const m = allMedicines.find(x => x.id === id);
    if (!m) return;

    document.getElementById('m_id').value = m.id;
    document.getElementById('med-panel-title').innerText = 'Edit Medicine';

    document.getElementById('m_name').value = m.name;
    document.getElementById('m_batch').value = m.batch || '';
    document.getElementById('m_exp').value = m.expiry;
    document.getElementById('m_qty').value = m.quantity;
    document.getElementById('m_price').value = m.price || 0;
    document.getElementById('m_disc').value = m.discount || 0;

    document.getElementById('med-panel').classList.remove('hidden');
};

window.submitMed = async () => {
    const id = document.getElementById('m_id').value;
    const data = {
        name: document.getElementById('m_name').value,
        batch: document.getElementById('m_batch').value,
        expiry: document.getElementById('m_exp').value,
        quantity: document.getElementById('m_qty').value,
        price: document.getElementById('m_price').value,
        discount: document.getElementById('m_disc').value
    };

    if (!data.name || !data.quantity || !data.expiry) return showToast('Name, Qty, and Expiry are required', 'error');

    try {
        if (id) {
            await api.updateMedicine(id, data);
            showToast('Medicine updated');
        } else {
            await api.addMedicine(data);
            showToast('Medicine added');
        }
        loadMedicines();
        closeMedPanel();
    } catch {
        showToast(`Failed to ${id ? 'update' : 'add'} medicine`, 'error');
    }
};
