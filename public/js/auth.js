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

    checkAuth(requiredRole = null) {
        const token = localStorage.getItem('medtrack_token');
        const role = localStorage.getItem('medtrack_role');

        if (!token) {
            window.location.href = '/login';
            return { authenticated: false };
        }

        if (requiredRole && role !== requiredRole) {
            window.location.href = role === 'admin' ? '/admin-dashboard' : '/ward-dashboard';
            return { authenticated: false };
        }

        return { token, role, authenticated: true };
    },

    getUserData() {
        return {
            email: localStorage.getItem('medtrack_email') || 'User',
            role: localStorage.getItem('medtrack_role')
        };
    }
};

window.logout = auth.logout;

export function renderSidebar(activePage) {
    const role = localStorage.getItem('medtrack_role');

    let links = '';

    if (role === 'admin') {
        links = `
            <div class="sidebar-menu-group">
                <div class="menu-label">Pharmacy Core</div>
                <ul class="sidebar-nav">
                    <li class="nav-item"><a href="/admin-dashboard" class="${activePage === 'dashboard' ? 'active' : ''}"><i data-lucide="layout-dashboard"></i> <span>Dashboard</span></a></li>
                    <li class="nav-item"><a href="/medicines" class="${activePage === 'medicines' ? 'active' : ''}"><i data-lucide="pill"></i> <span>Medicines</span></a></li>
                    <li class="nav-item"><a href="/patients" class="${activePage === 'patients' ? 'active' : ''}"><i data-lucide="users"></i> <span>Patients</span></a></li>
                </ul>
            </div>
            <div class="sidebar-menu-group">
                <div class="menu-label">Hospital Ops</div>
                <ul class="sidebar-nav">
                    <li class="nav-item"><a href="/orders" class="${activePage === 'orders' ? 'active' : ''}"><i data-lucide="clipboard-list"></i> <span>Ward Orders</span></a></li>
                    <li class="nav-item"><a href="/analytics" class="${activePage === 'analytics' ? 'active' : ''}"><i data-lucide="bar-chart-2"></i> <span>Analytics</span></a></li>
                </ul>
            </div>
        `;
    } else {
        links = `
            <div class="sidebar-menu-group">
                <div class="menu-label">Ward Panel</div>
                <ul class="sidebar-nav">
                    <li class="nav-item"><a href="/ward-dashboard" class="${activePage === 'dashboard' ? 'active' : ''}"><i data-lucide="layout-dashboard"></i> <span>Overview</span></a></li>
                    <li class="nav-item"><a href="/medicines" class="${activePage === 'medicines' ? 'active' : ''}"><i data-lucide="pill"></i> <span>Browse Medicines</span></a></li>
                    <li class="nav-item"><a href="/orders" class="${activePage === 'orders' ? 'active' : ''}"><i data-lucide="shopping-cart"></i> <span>My Orders</span></a></li>
                </ul>
            </div>
        `;
    }

    const userData = auth.getUserData();

    return `
        <aside class="sidebar modern-sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">
                    <div class="logo-icon"><i data-lucide="cross"></i></div>
                    <span class="logo-text" id="sidebarAppTitle">${role === 'admin' ? 'MedTrack Admin' : 'Ward Hub'}</span>
                </div>
            </div>
            ${links}
            <div class="sidebar-bottom">
                <div class="user-profile-widget" style="display:flex; align-items:center; gap:12px; padding:16px; margin:0 12px; background:rgba(255,255,255,0.05); border-radius:12px">
                    <div class="avatar" style="width:36px; height:36px; border-radius:50%; background:var(--color-primary); color:white; display:flex; align-items:center; justify-content:center; font-weight:bold">${userData.email[0].toUpperCase()}</div>
                    <div class="user-info" style="flex:1; overflow:hidden">
                        <div class="user-name" style="font-weight:600; font-size:0.85rem; white-space:nowrap; text-overflow:ellipsis; overflow:hidden">${userData.email}</div>
                        <div class="user-role" style="font-size:0.75rem; color:#94a3b8; text-transform:capitalize">${role}</div>
                    </div>
                </div>
                <ul class="sidebar-nav mt-3">
                    <li class="nav-item"><a href="#" onclick="logout()" style="color:#f43f5e"><i data-lucide="log-out"></i> <span>Log out</span></a></li>
                </ul>
            </div>
        </aside>
    `;
}

export function renderTopbar(title) {
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
                <span class="badge ${role === 'admin' ? 'badge-info' : 'badge-warning'}">${role === 'admin' ? 'Pharmacy Admin' : 'Ward User'}</span>
                <button class="topbar-btn has-badge">
                    <i data-lucide="bell"></i>
                    <span class="indicator"></span>
                </button>
                <div class="topbar-profile">
                    <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg, var(--color-primary), var(--color-accent));display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;cursor:pointer">
                        ${role === 'admin' ? 'AD' : 'WD'}
                    </div>
                </div>
            </div>
        </header>
    `;
}
