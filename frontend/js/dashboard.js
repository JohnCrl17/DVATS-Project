// ======================
// 🌐 GLOBAL CONFIG
// ======================
const API_BASE_URL = 'https://dvats-project.onrender.com/api';  // ✅ May /api na dito
const CONFIG = { 
    headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true' 
    } 
};

// ======================
// 🚀 INIT
// ======================
document.addEventListener('DOMContentLoaded', () => {
    const userRole = localStorage.getItem('userRole');

    if (!userRole) {
        window.location.href = 'login.html';
        return;
    }

    initSidebar();
    initPSTClock();
    initSearch();
    initLogout();

    if (userRole === 'staff') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        const brandName = document.querySelector('.brand-name');
        if (brandName) brandName.innerText = "DASMA STAFF";
        const navContainer = document.getElementById('navContainer');
        if (navContainer) navContainer.classList.replace('space-y-2', 'space-y-4');
    }

    loadDashboardStats();
    loadRecentActivity();
});

// ======================
// 🧠 SAFE FETCH HELPER
// ======================
async function safeFetch(url) {
    try {
        const response = await fetch(url, CONFIG);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("❌ Fetch failed:", error);
        throw error;
    }
}

// ======================
// 📊 DASHBOARD STATS
// ======================
async function loadDashboardStats() {
    try {
        // ✅ TAMA NA: Tinanggal yung extra /api
        const stats = await safeFetch(`${API_BASE_URL}/web-dashboard/summary`);

        document.getElementById('clientsCount') && (document.getElementById('clientsCount').innerText = stats.totalClients || 0);
        document.getElementById('violationsCount') && (document.getElementById('violationsCount').innerText = stats.totalViolations || 0);
        document.getElementById('appointmentsCount') && (document.getElementById('appointmentsCount').innerText = stats.totalAppointments || 0);
        document.getElementById('enforcersCount') && (document.getElementById('enforcersCount').innerText = stats.totalEnforcers || 0);

    } catch (err) {
        console.warn("⚠️ Using fallback stats:", err);
        const ids = ['clientsCount', 'violationsCount', 'appointmentsCount', 'enforcersCount'];
        ids.forEach(id => document.getElementById(id) && (document.getElementById(id).innerText = "0"));
    }
}

// ======================
// 📄 RECENT ACTIVITY
// ======================
async function loadRecentActivity() {
    const list = document.getElementById('activityList');
    if (!list) return;

    try {
        // ✅ TAMA NA: Tinanggal yung extra /api
        const activities = await safeFetch(`${API_BASE_URL}/web-dashboard/recent-activity`);

        if (!Array.isArray(activities) || activities.length === 0) {
            list.innerHTML = `<tr><td colspan="4" class="text-center py-10 opacity-50 italic">No recent activity found.</td></tr>`;
            return;
        }

        list.innerHTML = activities.map(act => {
            const badgeColor = act.type === 'Violation' ? "bg-red-500" : act.type === 'Appointment' ? "bg-amber-500" : "bg-blue-500";
            const statusColor = (act.status?.toLowerCase() === 'paid' || act.status?.toLowerCase() === 'verified') ? "text-emerald-600" : "text-amber-600";
            const formattedDate = act.activity_date ? new Date(act.activity_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

            return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-10 py-5"><span class="px-3 py-1 rounded-lg text-[10px] text-white uppercase font-bold ${badgeColor}">${act.type}</span></td>
                    <td class="px-10 py-5 text-slate-700 font-bold">${act.description}</td>
                    <td class="px-10 py-5 text-slate-400 font-medium italic">${formattedDate}</td>
                    <td class="px-10 py-5 text-right"><span class="${statusColor} uppercase tracking-tighter italic text-xs font-black">${act.status || 'Pending'}</span></td>
                </tr>`;
        }).join('');

    } catch (err) {
        list.innerHTML = `<tr><td colspan="4" class="text-center py-10 text-red-400 italic">Failed to load live data.</td></tr>`;
    }
}

// ======================
// 🕒 CLOCK
// ======================
function initPSTClock() {
    const timeElement = document.getElementById('pst-time');
    if (!timeElement) return;

    const updateTime = () => {
        const options = {
            timeZone: 'Asia/Manila',
            weekday: 'short',
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        timeElement.textContent = new Date().toLocaleString('en-US', options);
    };

    setInterval(updateTime, 1000);
    updateTime();
}

// ======================
// 📂 SIDEBAR
// ======================
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleBtn = document.getElementById('sidebarToggle');

    if (toggleBtn && sidebar && mainContent) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('main-expanded');
        });
    }
}

// ======================
// 🔍 SEARCH
// ======================
function initSearch() {
    const searchInput = document.getElementById('dashboardSearch');
    if (!searchInput) return;

    searchInput.addEventListener('keyup', () => {
        const filter = searchInput.value.toLowerCase();
        const rows = document.querySelectorAll('#activityList tr');

        rows.forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(filter) ? "" : "none";
        });
    });
}

// ======================
// 🚪 LOGOUT
// ======================
function initLogout() {
    const logoutBtn = document.querySelector('.logout-link');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();

            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position:fixed; inset:0; z-index:99999;
                background:rgba(0,0,0,0.4);
                backdrop-filter:blur(8px);
                -webkit-backdrop-filter:blur(8px);
                display:flex; align-items:center; justify-content:center; padding:40px;
            `;

            overlay.innerHTML = `
                <div style="
                    background:rgba(255,255,255,0.95);
                    border-radius:20px;
                    width:100%;
                    max-width:320px;
                    overflow:hidden;
                    box-shadow:0 20px 60px rgba(0,0,0,0.3);
                    font-family:'Inter',sans-serif;
                ">
                    <div style="padding:24px 20px 16px; text-align:center;">
                        <div style="
                            width:48px; height:48px; border-radius:50%;
                            background:#fee2e2; margin:0 auto 12px;
                            display:flex; align-items:center; justify-content:center;
                        ">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                <polyline points="16 17 21 12 16 7"/>
                                <line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                        </div>
                        <p style="font-size:17px; font-weight:800; color:#0f172a; margin:0 0 6px;">Logout</p>
                        <p style="font-size:13px; color:#64748b; margin:0; font-weight:500;">Confirm Logout from System?</p>
                    </div>
                    <div style="border-top:1px solid #f1f5f9; display:flex;">
                        <button id="sysLogoutCancel" style="
                            flex:1; padding:16px; border:none; background:none;
                            font-size:15px; font-weight:600; color:#64748b;
                            cursor:pointer; border-right:1px solid #f1f5f9;
                            font-family:'Inter',sans-serif;
                        ">Cancel</button>
                        <button id="sysLogoutConfirm" style="
                            flex:1; padding:16px; border:none; background:none;
                            font-size:15px; font-weight:700; color:#ef4444;
                            cursor:pointer; font-family:'Inter',sans-serif;
                        ">Logout</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            document.getElementById('sysLogoutCancel').onclick = () => overlay.remove();
            document.getElementById('sysLogoutConfirm').onclick = () => {
                localStorage.clear();
                window.location.href = 'login.html';
            };

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.remove();
            });
        });
    }
}