import { api, showToast, showBillModal } from './api.js';
import { auth, renderSidebar, renderTopbar } from './auth.js';

let allMedicines = [];
let userRole = null;
// cart: { [medicineId]: { medicine, quantity } }
let cart = {};

document.addEventListener('DOMContentLoaded', async () => {
    const authStatus = auth.checkAuth();
    if (!authStatus.authenticated) return;
    userRole = authStatus.role;

    document.getElementById('sidebar-container').innerHTML = renderSidebar('medicines');
    document.getElementById('topbar-container').innerHTML = renderTopbar();
    if (window.lucide) window.lucide.createIcons();

    if (userRole === 'admin') {
        document.getElementById('admin-actions').classList.remove('hidden');
    } else {
        // Insert cart UI for ward users
        insertCartUI();
    }

    await loadMedicines();

    document.getElementById('search-input').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = allMedicines.filter(m =>
            m.name.toLowerCase().includes(q) || (m.batch || '').toLowerCase().includes(q)
        );
        renderTable(filtered);
    });
});

function insertCartUI() {
    const pageEl = document.querySelector('.page');
    const cartHtml = `
        <!-- Cart Panel -->
        <div id="cart-panel" style="
            position:fixed;right:24px;bottom:24px;z-index:500;
            background:white;border-radius:20px;width:360px;
            box-shadow:0 20px 60px rgba(0,0,0,0.15);border:1px solid #E2E8F0;
            overflow:hidden;transform:translateY(110%);transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1)">
            <div style="background:linear-gradient(135deg,#1E5E75,#2FB7B3);padding:16px 20px;display:flex;align-items:center;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:10px;color:white">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                    <span style="font-weight:700;font-size:1rem">Medicine Cart</span>
                    <span id="cart-count-badge" style="background:rgba(255,255,255,0.25);border-radius:20px;padding:2px 10px;font-size:0.8rem;font-weight:700">0 items</span>
                </div>
                <button onclick="toggleCart()" style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:0.8rem">✕ Close</button>
            </div>
            <div id="cart-items" style="max-height:300px;overflow-y:auto;padding:14px 16px">
                <div id="cart-empty" style="text-align:center;padding:24px;color:#94A3B8;font-size:0.9rem">
                    🛒 Your cart is empty.<br>Click "Add to Cart" on any medicine.
                </div>
            </div>
            <div id="cart-footer" style="padding:14px 16px;border-top:1px solid #E2E8F0;display:none">
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:0.9rem;color:#475569">
                    <span>Estimated Total</span>
                    <span id="cart-total" style="font-weight:700;color:#1E5E75">₹0.00</span>
                </div>
                <button onclick="openCheckoutModal()"
                    style="width:100%;padding:13px;background:linear-gradient(135deg,#1E5E75,#2FB7B3);
                           border:none;border-radius:12px;color:white;font-weight:700;cursor:pointer;
                           font-size:0.95rem;letter-spacing:0.01em">
                    📋 Place Order & Generate Bill
                </button>
            </div>
        </div>

        <!-- Floating cart toggle button -->
        <button id="cart-toggle-btn" onclick="toggleCart()"
            style="position:fixed;right:24px;bottom:24px;z-index:499;
                   background:linear-gradient(135deg,#1E5E75,#2FB7B3);border:none;
                   border-radius:50px;padding:14px 22px;color:white;cursor:pointer;
                   font-weight:700;font-size:0.9rem;box-shadow:0 8px 24px rgba(30,94,117,0.4);
                   display:flex;align-items:center;gap:10px;transition:all 0.3s">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span>View Cart</span>
            <span id="cart-fab-count" style="background:rgba(255,255,255,0.3);border-radius:20px;padding:2px 8px;font-size:0.8rem">0</span>
        </button>

        <!-- Checkout Modal -->
        <div id="checkout-modal" style="display:none;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:1000;align-items:center;justify-content:center;backdrop-filter:blur(4px)">
            <div style="background:white;border-radius:20px;max-width:480px;width:95%;padding:32px;box-shadow:0 24px 64px rgba(0,0,0,0.18)">
                <h3 style="color:#1E5E75;margin-bottom:6px;font-size:1.25rem">Confirm Order Details</h3>
                <p style="color:#64748B;font-size:0.9rem;margin-bottom:24px">Fill in the delivery information before placing your order.</p>
                <div style="display:flex;flex-direction:column;gap:14px">
                    <div>
                        <label style="font-size:0.85rem;font-weight:600;color:#374151;display:block;margin-bottom:6px">Ward Name *</label>
                        <input id="co_ward" type="text" placeholder="e.g. ICU Ward, Pediatrics..."
                            style="width:100%;padding:11px 14px;border:1px solid #E2E8F0;border-radius:10px;font-size:0.9rem;outline:none;box-sizing:border-box">
                    </div>
                    <div>
                        <label style="font-size:0.85rem;font-weight:600;color:#374151;display:block;margin-bottom:6px">Room / Bed No. *</label>
                        <input id="co_room" type="text" placeholder="e.g. Room 204, Bed 3B"
                            style="width:100%;padding:11px 14px;border:1px solid #E2E8F0;border-radius:10px;font-size:0.9rem;outline:none;box-sizing:border-box">
                    </div>
                    <div>
                        <label style="font-size:0.85rem;font-weight:600;color:#374151;display:block;margin-bottom:6px">Doctor / Nurse Name</label>
                        <input id="co_doctor" type="text" placeholder="e.g. Dr. Sharma"
                            style="width:100%;padding:11px 14px;border:1px solid #E2E8F0;border-radius:10px;font-size:0.9rem;outline:none;box-sizing:border-box">
                    </div>
                </div>
                <div style="display:flex;gap:12px;margin-top:24px">
                    <button onclick="closeCheckoutModal()"
                        style="flex:1;padding:12px;border:1px solid #E2E8F0;border-radius:10px;background:white;cursor:pointer;font-weight:600;color:#475569">
                        Cancel
                    </button>
                    <button onclick="submitCartOrder()"
                        style="flex:2;padding:12px;background:linear-gradient(135deg,#1E5E75,#2FB7B3);border:none;border-radius:10px;color:white;cursor:pointer;font-weight:700">
                        ✅ Submit Order
                    </button>
                </div>
            </div>
        </div>
    `;
    document.querySelector('.page-container').insertAdjacentHTML('beforeend', cartHtml);
}

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
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:40px;color:#888">No medicines found</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(m => {
        const isLow     = m.quantity <= 10;
        const isExpired = m.expiry < today;

        let badges = '';
        if (isLow)     badges += '<span class="badge badge-warning">Low Stock</span> ';
        if (isExpired) badges += '<span class="badge badge-danger">Expired</span> ';

        let actionCol = '';
        if (userRole === 'admin') {
            actionCol = `
                <td>
                    <div>₹${Number(m.finalPrice || m.price || 0).toFixed(2)}</div>
                    ${m.discount > 0 ? `<span class="td-subtitle">₹${m.price} (-${m.discount}%)</span>` : ''}
                </td>
                <td class="text-right">
                    <button class="icon-btn text-danger" onclick="deleteMed('${m.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
                    <button class="icon-btn text-primary" onclick="editMed('${m.id}')" title="Edit"><i data-lucide="edit-2"></i></button>
                </td>
            `;
        } else {
            const inCart = cart[m.id];
            actionCol = `
                <td class="text-right" style="white-space:nowrap">
                    ${inCart
                        ? `<div style="display:inline-flex;align-items:center;gap:6px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:10px;padding:4px 8px">
                               <button onclick="changeCartQty('${m.id}',-1)" style="background:#1E5E75;color:white;border:none;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:1rem;font-weight:700">−</button>
                               <span style="font-weight:700;min-width:24px;text-align:center;color:#1E5E75">${inCart.quantity}</span>
                               <button onclick="changeCartQty('${m.id}',1)" style="background:#1E5E75;color:white;border:none;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:1rem;font-weight:700">+</button>
                               <button onclick="removeFromCart('${m.id}')" style="background:#FEE2E2;color:#B91C1C;border:none;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:0.8rem">✕</button>
                           </div>`
                        : `<button class="btn btn-primary btn-sm" onclick="addToCart('${m.id}')" ${m.quantity <= 0 ? 'disabled' : ''}>
                               + Add to Cart
                           </button>`
                    }
                </td>
            `;
        }

        return `
            <tr>
                <td><strong>${m.name}</strong>${badges ? `<div class="mt-1">${badges}</div>` : ''}</td>
                <td>${m.batch || '—'}</td>
                <td><span class="${isExpired ? 'text-danger' : ''}">${m.expiry}</span></td>
                <td><span style="font-weight:600;color:${isLow ? 'var(--color-red)' : 'inherit'}">${m.quantity}</span></td>
                ${actionCol}
            </tr>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

/* ── Cart helpers ── */
function renderCart() {
    const itemsEl  = document.getElementById('cart-items');
    const footerEl = document.getElementById('cart-footer');
    const emptyEl  = document.getElementById('cart-empty');
    const countBadge = document.getElementById('cart-count-badge');
    const fabCount   = document.getElementById('cart-fab-count');

    const entries = Object.values(cart);
    const totalItems = entries.reduce((s, e) => s + e.quantity, 0);
    const totalCost  = entries.reduce((s, e) => {
        const price    = Number(e.medicine.price || 0);
        const disc     = Number(e.medicine.discount || 0);
        const final    = price - (price * disc / 100);
        return s + final * e.quantity;
    }, 0);

    if (countBadge) countBadge.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
    if (fabCount)   fabCount.textContent   = totalItems;

    if (!entries.length) {
        emptyEl && (emptyEl.style.display = 'block');
        footerEl && (footerEl.style.display = 'none');
        itemsEl.innerHTML = '';
        itemsEl.appendChild(document.getElementById('cart-empty') || document.createElement('div'));
        return;
    }

    emptyEl && (emptyEl.style.display = 'none');
    footerEl && (footerEl.style.display = 'block');

    document.getElementById('cart-total').textContent = `₹${totalCost.toFixed(2)}`;

    itemsEl.innerHTML = entries.map(e => {
        const price  = Number(e.medicine.price || 0);
        const disc   = Number(e.medicine.discount || 0);
        const final  = price - (price * disc / 100);
        return `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F1F5F9">
                <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.medicine.name}</div>
                    <div style="font-size:0.78rem;color:#64748B">₹${final.toFixed(2)} each</div>
                </div>
                <div style="display:flex;align-items:center;gap:5px">
                    <button onclick="changeCartQty('${e.medicine.id}',-1)" style="background:#E2E8F0;border:none;border-radius:6px;width:24px;height:24px;cursor:pointer;font-weight:700">−</button>
                    <span style="font-weight:700;min-width:20px;text-align:center">${e.quantity}</span>
                    <button onclick="changeCartQty('${e.medicine.id}',1)"  style="background:#E2E8F0;border:none;border-radius:6px;width:24px;height:24px;cursor:pointer;font-weight:700">+</button>
                    <button onclick="removeFromCart('${e.medicine.id}')" style="background:#FEE2E2;color:#B91C1C;border:none;border-radius:6px;width:24px;height:24px;cursor:pointer;font-size:0.8rem">✕</button>
                </div>
                <div style="font-weight:700;color:#1E5E75;font-size:0.9rem;min-width:64px;text-align:right">₹${(final * e.quantity).toFixed(2)}</div>
            </div>
        `;
    }).join('');
}

let cartOpen = false;
window.toggleCart = () => {
    const panel  = document.getElementById('cart-panel');
    const fabBtn = document.getElementById('cart-toggle-btn');
    cartOpen = !cartOpen;
    if (panel) {
        panel.style.transform = cartOpen ? 'translateY(0)' : 'translateY(110%)';
        panel.style.bottom    = cartOpen ? '24px' : '24px';
    }
    if (fabBtn) fabBtn.style.opacity = cartOpen ? '0' : '1';
};

window.addToCart = (id) => {
    const m = allMedicines.find(x => x.id === id);
    if (!m) return;
    cart[id] = { medicine: m, quantity: 1 };
    renderTable(allMedicines);  // refresh table to show stepper
    renderCart();
    if (!cartOpen) window.toggleCart();
    showToast(`${m.name} added to cart`);
};

window.removeFromCart = (id) => {
    delete cart[id];
    renderTable(allMedicines);
    renderCart();
};

window.changeCartQty = (id, delta) => {
    if (!cart[id]) return;
    const m   = cart[id].medicine;
    const max = m.quantity;
    const newQty = cart[id].quantity + delta;
    if (newQty <= 0) { window.removeFromCart(id); return; }
    if (newQty > max) { showToast(`Only ${max} units in stock`, 'error'); return; }
    cart[id].quantity = newQty;
    renderTable(allMedicines);
    renderCart();
};

window.openCheckoutModal = () => {
    if (!Object.keys(cart).length) { showToast('Cart is empty', 'error'); return; }
    const modal = document.getElementById('checkout-modal');
    modal.style.display = 'flex';
};

window.closeCheckoutModal = () => {
    document.getElementById('checkout-modal').style.display = 'none';
};

window.submitCartOrder = async () => {
    const ward   = document.getElementById('co_ward').value.trim();
    const room   = document.getElementById('co_room').value.trim();
    const doctor = document.getElementById('co_doctor').value.trim() || 'Ward Staff';

    if (!ward || !room) { showToast('Ward and Room are required', 'error'); return; }

    const items = Object.values(cart).map(e => ({
        medicineId:   e.medicine.id,
        medicineName: e.medicine.name,
        quantity:     e.quantity,
        unitPrice:    Number(e.medicine.price || 0),
        discount:     Number(e.medicine.discount || 0)
    }));

    try {
        const result = await api.createCartOrder({ ward, room, doctor, items });
        showToast(`Order placed! Bill: ₹${result.bill.total.toFixed(2)}`, 'success');
        closeCheckoutModal();
        // Show bill modal
        showBillModal(result.bill);
        // Clear cart
        cart = {};
        renderCart();
        if (cartOpen) window.toggleCart();
        await loadMedicines();
    } catch (e) {
        showToast('Failed to place order: ' + (e.message || 'Server error'), 'error');
    }
};

/* ── Admin CRUD ── */
window.deleteMed = async (id) => {
    if (!confirm('Delete this medicine?')) return;
    try {
        await api.deleteMedicine(id);
        showToast('Medicine deleted');
        loadMedicines();
    } catch { showToast('Error deleting medicine', 'error'); }
};

window.openMedPanel = () => {
    document.getElementById('m_id').value = '';
    document.getElementById('med-panel-title').innerText = 'Add New Medicine';
    ['m_name','m_batch','m_exp','m_qty','m_price','m_disc'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('med-panel').classList.remove('hidden');
};

window.closeMedPanel = () => {
    document.getElementById('med-panel').classList.add('hidden');
};

window.editMed = (id) => {
    const m = allMedicines.find(x => x.id === id);
    if (!m) return;
    document.getElementById('m_id').value        = m.id;
    document.getElementById('med-panel-title').innerText = 'Edit Medicine';
    document.getElementById('m_name').value  = m.name;
    document.getElementById('m_batch').value = m.batch || '';
    document.getElementById('m_exp').value   = m.expiry;
    document.getElementById('m_qty').value   = m.quantity;
    document.getElementById('m_price').value = m.price || 0;
    document.getElementById('m_disc').value  = m.discount || 0;
    document.getElementById('med-panel').classList.remove('hidden');
};

window.submitMed = async () => {
    const id   = document.getElementById('m_id').value;
    const data = {
        name:     document.getElementById('m_name').value,
        batch:    document.getElementById('m_batch').value,
        expiry:   document.getElementById('m_exp').value,
        quantity: document.getElementById('m_qty').value,
        price:    document.getElementById('m_price').value,
        discount: document.getElementById('m_disc').value
    };
    if (!data.name || !data.quantity || !data.expiry) return showToast('Name, Qty, and Expiry are required', 'error');
    try {
        if (id) { await api.updateMedicine(id, data); showToast('Medicine updated'); }
        else    { await api.addMedicine(data);         showToast('Medicine added');   }
        loadMedicines();
        window.closeMedPanel();
    } catch { showToast(`Failed to ${id ? 'update' : 'add'} medicine`, 'error'); }
};