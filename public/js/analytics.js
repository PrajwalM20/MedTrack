import { api, showToast } from './api.js';
import { auth, renderSidebar, renderTopbar } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const authStatus = auth.checkAuth('admin');
    if (!authStatus.authenticated) return;

    document.getElementById('sidebar-container').innerHTML = renderSidebar('analytics');
    document.getElementById('topbar-container').innerHTML = renderTopbar();
    if (window.lucide) window.lucide.createIcons();

    await loadAnalytics();
});

async function loadAnalytics() {
    try {
        const summary = await api.getAnalyticsSummary();
        const sales = await api.getMedicineSales();

        document.getElementById('val-revenue').innerText = '₹' + summary.totalRevenue.toFixed(2);
        document.getElementById('val-sales').innerText = summary.totalSales;

        if (summary.topMedicine) {
            document.getElementById('val-topmed').innerText = summary.topMedicine.name;
            document.getElementById('val-topmed-qty').innerText = summary.topMedicine.quantity + ' units sold';
        } else {
            document.getElementById('val-topmed').innerText = '-';
        }

        renderSalesChart(sales);
    } catch (e) { showToast('Error loading analytics', 'error') }
}

function renderSalesChart(sales) {
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;

    const labels = Object.keys(sales);
    const data = Object.values(sales).map(s => s.amount);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue by Medicine (₹)',
                data: data,
                backgroundColor: 'rgba(2, 132, 199, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}
