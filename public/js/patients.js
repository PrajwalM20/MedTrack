import { api, showToast } from './api.js';
import { auth, renderSidebar, renderTopbar } from './auth.js';

let allPatients = [];

document.addEventListener('DOMContentLoaded', async () => {
    const authStatus = auth.checkAuth('admin');
    if (!authStatus.authenticated) return;

    document.getElementById('sidebar-container').innerHTML = renderSidebar('patients');
    document.getElementById('topbar-container').innerHTML = renderTopbar();
    if (window.lucide) window.lucide.createIcons();

    await loadPatients();

    document.getElementById('search-input').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = allPatients.filter(p => p.name.toLowerCase().includes(q) || p.disease.toLowerCase().includes(q));
        renderTable(filtered);
    });
});

async function loadPatients() {
    try {
        allPatients = await api.getPatients();
        renderTable(allPatients);
    } catch (e) { showToast('Error loading patients', 'error') }
}

function renderTable(list) {
    const container = document.getElementById('patient-cards');

    if (!list.length) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted)">No patients found</div>';
        return;
    }

    container.innerHTML = list.map(p => `
        <div class="profile-card">
            <div class="profile-card-header">
                <div>
                    <div class="profile-card-title">${p.name}</div>
                    <div class="profile-card-meta">${p.age} yrs • ${p.gender}</div>
                </div>
                <div style="width:40px; height:40px; background:linear-gradient(135deg, var(--color-primary), var(--color-accent)); border-radius:12px; display:flex; align-items:center; justify-content:center; color:white; box-shadow:0 4px 8px rgba(2,132,199,0.3)">
                    <i data-lucide="user"></i>
                </div>
            </div>
            <div class="profile-card-body">
                <div><strong>Condition:</strong> ${p.disease}</div>
                <div><strong>Meds Assigned:</strong> <span class="badge badge-info">${p.medicines ? p.medicines.length : 0}</span></div>
                ${p.nextRecheck ? `<div class="mt-1"><strong>Recheck:</strong> <span style="color:var(--color-primary)">${p.nextRecheck}</span></div>` : ''}
            </div>
            <div class="profile-card-actions">
                <button class="btn btn-outline text-primary" onclick="editPatient('${p.id}')"><i data-lucide="edit-2"></i> Edit</button>
                <button class="btn btn-outline text-danger" onclick="deletePatient('${p.id}')"><i data-lucide="trash-2"></i> Delete</button>
            </div>
        </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
}

window.deletePatient = async (id) => {
    if (!confirm('Delete patient?')) return;
    try {
        await api.deletePatient(id);
        showToast('Patient deleted');
        loadPatients();
    } catch { showToast('Error deleting patient', 'error'); }
};

window.openPatientPanel = () => {
    document.getElementById('p_id').value = '';
    document.getElementById('patient-panel-title').innerText = 'Register Patient';
    ['p_name', 'p_age', 'p_disease', 'p_recheck'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('p_gender').value = 'Male';
    document.getElementById('add-patient-panel').classList.remove('hidden');
};

window.closePatientPanel = () => {
    document.getElementById('add-patient-panel').classList.add('hidden');
};

window.editPatient = (id) => {
    const p = allPatients.find(x => x.id === id);
    if (!p) return;

    document.getElementById('p_id').value = p.id;
    document.getElementById('patient-panel-title').innerText = 'Edit Patient';

    document.getElementById('p_name').value = p.name;
    document.getElementById('p_age').value = p.age;
    document.getElementById('p_gender').value = p.gender;
    document.getElementById('p_disease').value = p.disease;
    document.getElementById('p_recheck').value = p.nextRecheck || '';

    document.getElementById('add-patient-panel').classList.remove('hidden');
};

window.submitPatient = async () => {
    const id = document.getElementById('p_id').value;
    const data = {
        name: document.getElementById('p_name').value,
        age: document.getElementById('p_age').value,
        gender: document.getElementById('p_gender').value,
        disease: document.getElementById('p_disease').value,
        nextRecheck: document.getElementById('p_recheck').value
    };

    if (!data.name || !data.age || !data.disease) return showToast('Required fields missing', 'error');

    try {
        if (id) {
            await api.updatePatient(id, data);
            showToast('Patient updated successfully');
        } else {
            await api.addPatient(data);
            showToast('Patient added successfully');
        }
        loadPatients();
        closePatientPanel();
    } catch { showToast(`Failed to ${id ? 'update' : 'add'} patient`, 'error'); }
};
