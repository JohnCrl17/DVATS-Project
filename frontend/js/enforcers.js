/**
 * DVATS Admin - Enforcers Management Script
 * Mirrors clients.js structure
 */

const API_BASE_URL = "https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api";

let localEnforcersArray = [];
let currentFilterStatus = 'all';
let currentSearchTerm   = '';

document.addEventListener('DOMContentLoaded', () => {
    fetchEnforcers();
    initSidebar();
    initSearch();

    // Auto-refresh every 5 seconds
    setInterval(fetchEnforcers, 5000);
});

// ─── FETCH ALL ENFORCERS ──────────────────────────────────────
async function fetchEnforcers() {
    try {
        const response = await fetch(`${API_BASE_URL}/get_enforcer.php`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });

        if (!response.ok) throw new Error("Network error");

        const data = await response.json();

        // Safety check — kung hindi array ang bumalik (baka error object o wrapped response)
        if (!Array.isArray(data)) {
            console.warn("Expected array but got:", data);
            localEnforcersArray = [];
        } else {
            localEnforcersArray = data;
        }

        updateStats();
        renderTable();

    } catch (error) {
        console.error("Fetch error:", error);
        document.getElementById('enforcerTableBody').innerHTML = `
            <tr>
                <td colspan="6" class="py-10 text-center text-red-400 font-bold">
                    Failed to load data. Check Ngrok/Laragon.
                </td>
            </tr>`;
    }
}

// ─── STATS ───────────────────────────────────────────────────
function updateStats() {
    const total   = localEnforcersArray.length;
    const active  = localEnforcersArray.filter(e => e.status === 'active').length;
    const pending = localEnforcersArray.filter(e => e.status === 'pending').length;

    document.getElementById('statTotal').innerText   = total;
    document.getElementById('statActive').innerText  = active;
    document.getElementById('statPending').innerText = pending;
}

// ─── FILTER TABS ─────────────────────────────────────────────
function filterByStatus(status) {
    currentFilterStatus = status;
    ['all', 'active', 'pending'].forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (t === status) {
            el.className = "px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-white text-emerald-600 shadow-sm";
        } else {
            el.className = "px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-slate-500 hover:text-slate-800";
        }
    });
    renderTable();
}

// ─── RENDER TABLE ─────────────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('enforcerTableBody');
    tbody.innerHTML = '';

    const filtered = localEnforcersArray.filter(e => {
        const matchTab    = currentFilterStatus === 'all' || e.status === currentFilterStatus;
        const search      = currentSearchTerm.toLowerCase();
        const matchSearch = (e.full_name     || '').toLowerCase().includes(search)
                         || (e.badge_number  || '').toLowerCase().includes(search)
                         || (e.unit          || '').toLowerCase().includes(search)
                         || (e.email         || '').toLowerCase().includes(search);
        return matchTab && matchSearch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-20 text-center text-slate-400 italic font-medium">
                    No matching enforcer records found.
                </td>
            </tr>`;
        return;
    }

    filtered.forEach(officer => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/80 transition-all border-b border-slate-50";

        const statusDot = officer.status === 'active'
            ? 'bg-emerald-500'
            : 'bg-amber-500';

        const badgeMarkup = officer.badge_number
            ? `<span class="font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200/60 text-xs">${officer.badge_number}</span>`
            : `<span class="text-slate-300 italic text-xs">Unassigned</span>`;

        const actionBtn = officer.status === 'active'
            ? `<button onclick="toggleStatus('${officer.id}', 'active')" class="bg-amber-50 hover:bg-amber-100 text-amber-600 px-4 py-2 rounded-xl transition-all border border-amber-200/40 text-xs font-black uppercase tracking-wider">Deactivate</button>`
            : `<button onclick="toggleStatus('${officer.id}', 'pending')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-4 py-2 rounded-xl transition-all border border-emerald-200/40 text-xs font-black uppercase tracking-wider">Approve</button>`;

        // Initials fallback
        const initials = (officer.full_name || '?').charAt(0).toUpperCase();

        tr.innerHTML = `
            <td class="px-8 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full ${statusDot} flex-shrink-0"></div>
                    <div class="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-sm flex-shrink-0 uppercase">
                        ${initials}
                    </div>
                    <span class="text-slate-800 font-extrabold tracking-tight text-sm">${officer.full_name || 'Unknown'}</span>
                </div>
            </td>
            <td class="px-8 py-4">${badgeMarkup}</td>
            <td class="px-8 py-4 text-slate-500 font-medium text-sm">${officer.email || 'N/A'}</td>
            <td class="px-8 py-4 text-slate-600 font-semibold text-sm">Dasmariñas District</td>
            <td class="px-8 py-4">
                <span class="bg-slate-100 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 border border-slate-200/50 uppercase tracking-wide">
                    ${officer.unit || 'General Operations'}
                </span>
            </td>
            <td class="px-8 py-4 text-right flex items-center justify-end gap-2">
                <button onclick="viewEnforcer(${officer.id})" title="View Details"
                    class="w-9 h-9 bg-slate-50 text-slate-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all flex items-center justify-center shadow-inner">
                    <i class="bi bi-eye text-sm"></i>
                </button>
                <button onclick="deleteEnforcer(${officer.id})" title="Delete"
                    class="w-9 h-9 bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white rounded-xl transition-all flex items-center justify-center shadow-inner">
                    <i class="bi bi-trash text-sm"></i>
                </button>
                ${actionBtn}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ─── VIEW MODAL ───────────────────────────────────────────────
async function viewEnforcer(id) {
    if (!id) return;

    try {
        const response = await fetch(`${API_BASE_URL}/get_enforcer_details.php?id=${id}`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });

        const text = await response.text();
        if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
            console.error("Non-JSON response:", text);
            IosAlert.alert('System Error', 'Server returned an invalid response.');
            return;
        }

        const e = JSON.parse(text);

        // ── Populate modal fields
        document.getElementById('view-name').innerText    = e.full_name     || 'Unknown';
        document.getElementById('view-badge').innerText   = `Badge: ${e.badge_number || 'N/A'}`;
        document.getElementById('view-unit').innerText    = e.unit          || 'N/A';
        document.getElementById('view-email').innerText   = e.email         || 'No Email';
        document.getElementById('view-phone').innerText   = e.phone_number  || 'No Number';
        document.getElementById('view-gender').innerText  = e.gender        || 'N/A';
        document.getElementById('view-dob').innerText     = e.dob           || 'N/A';
        document.getElementById('view-status').innerText  = (e.status || 'pending').toUpperCase();
        document.getElementById('view-status').className  = e.status === 'active'
            ? 'px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-600'
            : 'px-3 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-600';

        // ── Face photo
        const faceImg  = document.getElementById('view-face');
        const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(e.full_name || 'E')}&background=00A36C&color=fff`;
        faceImg.src    = (e.face_data && e.face_data.length > 100) ? e.face_data : fallback;
        faceImg.onerror = () => { faceImg.src = fallback; };

        // ── QR image
        const qrImg = document.getElementById('view-qr');
        const btnQR = document.getElementById('btnShowQR');
        if (qrImg && btnQR) {
            if (e.qr_image && e.qr_image.length > 100) {
                qrImg.src           = e.qr_image;
                btnQR.style.display = 'flex';   // ← ipakita ang button
            } else {
                qrImg.src           = '';
                btnQR.style.display = 'none';   // ← itago kung walang QR
            }
        }

        document.getElementById('viewModalOverlay').classList.remove('hidden');

    } catch (err) {
        console.error("View Error:", err);
        IosAlert.alert('Error', 'Could not load enforcer details.');
    }
}

function closeModal() {
    document.getElementById('viewModalOverlay').classList.add('hidden');
}

window.onclick = function(e) {
    const modal = document.getElementById('viewModalOverlay');
    if (e.target === modal) closeModal();
};

// ─── TOGGLE STATUS ────────────────────────────────────────────
async function toggleStatus(id, currentStatus) {
    const nextStatus = currentStatus === 'active' ? 'pending' : 'active';

    try {
        const response = await fetch(`${API_BASE_URL}/get_enforcer.php`, {
            method:  'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'ngrok-skip-browser-warning': 'true'
            },
            body: `action=update_status&id=${id}&status=${nextStatus}`
        });

        const result = await response.json();
        if (result.success) {
            fetchEnforcers();
        } else {
            IosAlert.alert('Error', result.message || 'Status update failed.');
        }
    } catch (err) {
        console.error("Toggle error:", err);
        IosAlert.alert('Error', 'Could not update status.');
    }
}

// ─── DELETE ───────────────────────────────────────────────────
let currentDeleteId = null;

function deleteEnforcer(id) {
    currentDeleteId = id;
    document.getElementById('deleteModalOverlay').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('deleteModalOverlay').classList.add('hidden');
}

async function confirmDelete() {
    if (!currentDeleteId) return;
    closeDeleteModal();
    try {
        const response = await fetch(`${API_BASE_URL}/delete_enforcer.php?id=${currentDeleteId}`, {
            method:  'DELETE',
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        const data = await response.json();
        if (data.status === 'success') {
            IosAlert.toast('Enforcer record deleted.');
            fetchEnforcers();
        } else {
            IosAlert.alert('Error', data.message || 'Delete failed.');
        }
    } catch (err) {
        IosAlert.alert('Error', 'Could not connect to server.');
    }
}

// ─── SEARCH ───────────────────────────────────────────────────
function initSearch() {
    const input = document.getElementById('enforcerSearch');
    if (!input) return;
    input.addEventListener('input', e => {
        currentSearchTerm = e.target.value;
        renderTable();
    });
}

// ─── SIDEBAR ─────────────────────────────────────────────────
function initSidebar() {
    const sidebar     = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleBtn   = document.getElementById('sidebarToggle');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            if (mainContent) mainContent.classList.toggle('main-expanded');
        });
    }
}

// ─── CLOCK ───────────────────────────────────────────────────
function updateClock() {
    const el = document.getElementById('pst-time');
    if (!el) return;
    el.innerText = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
}
setInterval(updateClock, 1000);
updateClock();