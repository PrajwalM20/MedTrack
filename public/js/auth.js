import { api, showToast } from './api.js';

export const auth = {
    async doLogin(email, password, googleToken = null) {
        try {
            const res = await api.login({ email, password, googleToken });
            localStorage.setItem('medtrack_token', res.token);
            localStorage.setItem('medtrack_role', res.role);
            localStorage.setItem('medtrack_email', res.email);
            return res;
        } catch (e) {
            showToast('Invalid credentials or login failed', 'error');
            throw e;
        }
    },

    logout() {
        localStorage.removeItem('medtrack_token');
        localStorage.removeItem('medtrack_role');
        localStorage.removeItem('medtrack_email');
        window.location.href = '/';
    },

    /**
     * checkAuth — gate all protected pages.
     * @param {string|null} requiredRole  'admin' | 'ward' | null (any authenticated)
     */
    checkAuth(requiredRole = null) {
        const token = localStorage.getItem('medtrack_token');
        const role  = localStorage.getItem('medtrack_role');

        // Not logged in → go to login
        if (!token) {
            window.location.href = '/login';
            return { authenticated: false };
        }

        // Admin-only page accessed by ward user → redirect to ward dashboard
        if (requiredRole === 'admin' && role !== 'admin') {
            window.location.href = '/ward-dashboard';
            return { authenticated: false };
        }

        // Ward-only page accessed by admin → redirect to admin dashboard
        if (requiredRole === 'ward' && role !== 'ward') {
            window.location.href = '/admin-dashboard';
            return { authenticated: false };
        }

        return { token, role, authenticated: true };
    },

    getUserData() {
        return {
            email: localStorage.getItem('medtrack_email') || 'User',
            role:  localStorage.getItem('medtrack_role')
        };
    }
};

window.logout = auth.logout.bind(auth);

/* ─── Sidebar ─── */
export function renderSidebar(activePage) {
    const role = localStorage.getItem('medtrack_role');

    let links = '';

    if (role === 'admin') {
        links = `
            <div class="sidebar-menu-group">
                <div class="menu-label">Pharmacy Core</div>
                <ul class="sidebar-nav">
                    <li class="nav-item"><a href="/admin-dashboard" class="${activePage === 'dashboard' ? 'active' : ''}"><i data-lucide="layout-dashboard"></i><span>Dashboard</span></a></li>
                    <li class="nav-item"><a href="/medicines"       class="${activePage === 'medicines'  ? 'active' : ''}"><i data-lucide="pill"></i><span>Medicines</span></a></li>
                    <li class="nav-item"><a href="/patients"        class="${activePage === 'patients'   ? 'active' : ''}"><i data-lucide="users"></i><span>Patients</span></a></li>
                </ul>
            </div>
            <div class="sidebar-menu-group">
                <div class="menu-label">Hospital Ops</div>
                <ul class="sidebar-nav">
                    <li class="nav-item"><a href="/orders"    class="${activePage === 'orders'    ? 'active' : ''}"><i data-lucide="clipboard-list"></i><span>Ward Orders</span></a></li>
                    <li class="nav-item"><a href="/analytics" class="${activePage === 'analytics' ? 'active' : ''}"><i data-lucide="bar-chart-2"></i><span>Analytics</span></a></li>
                </ul>
            </div>
        `;
    } else {
        // Ward user — only ward-allowed pages
        links = `
            <div class="sidebar-menu-group">
                <div class="menu-label">Ward Panel</div>
                <ul class="sidebar-nav">
                    <li class="nav-item"><a href="/ward-dashboard" class="${activePage === 'dashboard' ? 'active' : ''}"><i data-lucide="layout-dashboard"></i><span>Overview</span></a></li>
                    <li class="nav-item"><a href="/medicines"      class="${activePage === 'medicines'  ? 'active' : ''}"><i data-lucide="pill"></i><span>Browse Medicines</span></a></li>
                    <li class="nav-item"><a href="/orders"         class="${activePage === 'orders'     ? 'active' : ''}"><i data-lucide="shopping-cart"></i><span>My Orders</span></a></li>
                </ul>
            </div>
        `;
    }

    const userData = auth.getUserData();
    const initials = role === 'admin' ? 'AD' : 'WD';
    const roleLabel = role === 'admin' ? 'Pharmacy Admin' : 'Ward Staff';
    const appTitle  = role === 'admin' ? 'MedTrack Admin' : 'Ward Hub';

    return `
        <aside class="sidebar modern-sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">
                    <div class="logo-icon"><i data-lucide="cross"></i></div>
                    <span class="logo-text">${appTitle}</span>
                </div>
                ${role === 'admin'
                    ? `<div style="margin:0 16px 0;padding:6px 12px;background:rgba(16,185,129,0.15);border-radius:8px;font-size:0.75rem;font-weight:700;color:#10B981;text-align:center;letter-spacing:0.05em">🔐 ADMIN ACCESS</div>`
                    : `<div style="margin:0 16px 0;padding:6px 12px;background:rgba(245,158,11,0.15);border-radius:8px;font-size:0.75rem;font-weight:700;color:#F59E0B;text-align:center;letter-spacing:0.05em">🏥 WARD USER</div>`
                }
            </div>
            ${links}
            <div class="sidebar-bottom">
                <div class="user-profile-widget" style="display:flex;align-items:center;gap:12px;padding:14px 16px;margin:0 12px;background:rgba(255,255,255,0.06);border-radius:12px;border:1px solid rgba(255,255,255,0.08)">
                    <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--color-primary),#1E5E75);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem;flex-shrink:0">${initials}</div>
                    <div style="flex:1;overflow:hidden;min-width:0">
                        <div style="font-weight:600;font-size:0.82rem;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;color:#e2e8f0">${userData.email}</div>
                        <div style="font-size:0.72rem;color:#94a3b8;margin-top:2px">${roleLabel}</div>
                    </div>
                </div>
                <ul class="sidebar-nav mt-3">
                    <li class="nav-item"><a href="#" onclick="logout()" style="color:#f43f5e"><i data-lucide="log-out"></i><span>Log out</span></a></li>
                </ul>
            </div>
        </aside>
    `;
}

/* ─── Topbar ─── */
export function renderTopbar() {
    const role = localStorage.getItem('medtrack_role');
    return `
        <header class="topbar glass-topbar">
            <div class="topbar-left">
                <div class="global-search">
                    <i data-lucide="search" class="search-icon"></i>
                    <input type="text" placeholder="Search records...">
                </div>
            </div>
            <div class="topbar-right">
                <span class="badge ${role === 'admin' ? 'badge-info' : 'badge-warning'}">${role === 'admin' ? '🔐 Pharmacy Admin' : '🏥 Ward User'}</span>
                <button class="topbar-btn has-badge">
                    <i data-lucide="bell"></i>
                    <span class="indicator"></span>
                </button>
                <div class="topbar-profile">
                    <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--color-primary),var(--color-accent));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;cursor:pointer">
                        ${role === 'admin' ? 'AD' : 'WD'}
                    </div>
                </div>
            </div>
        </header>
    `;
}