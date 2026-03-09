import { api, showToast } from './api.js';
import { auth, renderSidebar, renderTopbar } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const authStatus = auth.checkAuth();
    if (!authStatus.authenticated) return;

    // Inject Layout
    document.getElementById('sidebar-container').innerHTML = renderSidebar('dashboard');
    document.getElementById('topbar-container').innerHTML = renderTopbar('Dashboard');

    if (window.lucide) window.lucide.createIcons();

    if (authStatus.role === 'admin') {
        loadAdminDashboard();
    } else {
        loadWardDashboard();
    }
});

async function loadAdminDashboard() {
    try {
        const stats = await api.getDashboard();
        document.getElementById('val-revenue').innerText = '₹' + stats.todayRevenue.toFixed(2);
        document.getElementById('val-medicines').innerText = stats.totalMedicines;
        document.getElementById('val-patients').innerText = stats.totalPatients;
        document.getElementById('val-alerts').innerText = stats.lowStockCount;

        const summary = await api.getAnalyticsSummary();
        const sales = await api.getMedicineSales();

        // Load Revenue Chart (Mock visual for now)
        const ctxRev = document.getElementById('revenueChart');
        if (ctxRev) {
            new Chart(ctxRev, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Revenue',
                        data: [1200, 1900, 1500, 2200, 1800, 2600, stats.todayRevenue],
                        borderColor: '#0284C7',
                        backgroundColor: 'rgba(2, 132, 199, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    } catch (e) {
        showToast('Failed to load dashboard data', 'error');
    }
}

async function loadWardDashboard() {
    try {
        const orders = await api.getOrders();
        const pending = orders.filter(o => o.status === 'Pending').length;
        const delivered = orders.filter(o => o.status === 'Delivered').length;

        document.getElementById('val-pending').innerText = pending;
        document.getElementById('val-delivered').innerText = delivered;
        document.getElementById('val-total').innerText = orders.length;

    } catch (e) {
        showToast('Failed to load ward data', 'error');
    }
}
