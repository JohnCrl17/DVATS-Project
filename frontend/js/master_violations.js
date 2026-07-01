// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════
const API_BASE = 'https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api';
const HEADERS  = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    'Accept': 'application/json'
};

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
let violationsData  = [];
let deleteTargetId  = null;

// ═══════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[99999] px-5 py-3 rounded-2xl text-white text-xs font-bold shadow-xl transition-all`;
    
    if (type === 'success') toast.classList.add('bg-green-600');
    else if (type === 'error') toast.classList.add('bg-red-600');
    else toast.classList.add('bg-blue-600');

    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}

// ═══════════════════════════════════════════════════════════
// MODAL FUNCTIONS
// ═══════════════════════════════════════════════════════════
function openAddModal() {
    document.getElementById('editId').value = '';
    document.getElementById('ordinanceNo').value = '';
    document.getElementById('violationName').value = '';
    document.getElementById('firstOffense').value = '';
    document.getElementById('secondOffense').value = '';
    document.getElementById('thirdOffense').value = '';
    document.getElementById('modalTitle').textContent = 'Add Violation';
    document.getElementById('saveBtnText').textContent = 'Save';
    document.getElementById('violationModalOverlay').classList.remove('hidden');
}

function openEditModal(id) {
    const item = violationsData.find(v => v.id == id);
    if (!item) return;

    document.getElementById('editId').value = item.id;
    document.getElementById('ordinanceNo').value = item.ordinance_no || '';
    document.getElementById('violationName').value = item.violation_name || '';
    document.getElementById('firstOffense').value = item.first_offense || 0;
    document.getElementById('secondOffense').value = item.second_offense || 0;
    document.getElementById('thirdOffense').value = item.third_offense || 0;
    document.getElementById('modalTitle').textContent = 'Edit Violation';
    document.getElementById('saveBtnText').textContent = 'Update';
    document.getElementById('violationModalOverlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('violationModalOverlay').classList.add('hidden');
}

function openDeleteModal(id) {
    deleteTargetId = id;
    document.getElementById('deleteModalOverlay').classList.remove('hidden');
}

function closeDeleteModal() {
    deleteTargetId = null;
    document.getElementById('deleteModalOverlay').classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════
async function saveViolation() {
    const editId        = document.getElementById('editId').value;
    const ordinanceNo   = document.getElementById('ordinanceNo').value.trim();
    const violationName = document.getElementById('violationName').value.trim();
    const firstOffense  = document.getElementById('firstOffense').value.trim();
    const secondOffense = document.getElementById('secondOffense').value.trim();
    const thirdOffense  = document.getElementById('thirdOffense').value.trim();

    // Validation
    if (!ordinanceNo || !violationName) {
        showToast('Please fill in all fields.', 'error');
        return;
    }

    if (!firstOffense && !secondOffense && !thirdOffense) {
        showToast('Please enter at least one penalty amount.', 'error');
        return;
    }

    const payload = {
        ordinance_no:   ordinanceNo,
        violation_name: violationName,
        first_offense:  parseFloat(firstOffense) || 0,
        second_offense: parseFloat(secondOffense) || 0,
        third_offense:  parseFloat(thirdOffense) || 0
    };

    const isEdit = editId !== '';
    if (isEdit) payload.id = editId;

    try {
        const endpoint = isEdit ? `${API_BASE}/master_violations_api.php?action=update` 
                                : `${API_BASE}/master_violations_api.php?action=create`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === 'success') {
            showToast(isEdit ? 'Violation updated!' : 'Violation added!', 'success');
            closeModal();
            loadViolations();
        } else {
            showToast(result.message || 'Operation failed.', 'error');
        }
    } catch (error) {
        console.error('Save Error:', error);
        showToast('Network error. Check connection.', 'error');
    }
}

async function confirmDelete() {
    if (!deleteTargetId) return;

    try {
        const response = await fetch(`${API_BASE}/master_violations_api.php?action=delete`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ id: deleteTargetId })
        });

        const result = await response.json();

        if (result.status === 'success') {
            showToast('Violation deleted!', 'success');
            closeDeleteModal();
            loadViolations();
        } else {
            showToast(result.message || 'Delete failed.', 'error');
        }
    } catch (error) {
        console.error('Delete Error:', error);
        showToast('Network error. Check connection.', 'error');
    }
}

// ═══════════════════════════════════════════════════════════
// LOAD VIOLATIONS
// ═══════════════════════════════════════════════════════════
async function loadViolations() {
    try {
        const response = await fetch(`${API_BASE}/master_violations_api.php?action=read`, {
            headers: HEADERS
        });
        const result = await response.json();

        if (result.status === 'success') {
            violationsData = result.data || [];
            renderTable(violationsData);
            updateStats(violationsData);
        } else {
            violationsData = [];
            renderTable([]);
            updateStats([]);
        }
    } catch (error) {
        console.error('Load Error:', error);
        showToast('Failed to load violations.', 'error');
    }
}

// ═══════════════════════════════════════════════════════════
// RENDER TABLE
// ═══════════════════════════════════════════════════════════
function renderTable(data) {
    const tbody = document.getElementById('violationsTableBody');

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-8 py-12 text-center text-slate-400">
                    <i class="bi bi-inbox text-3xl block mb-2"></i>
                    <span class="text-xs font-bold">No ordinances found</span>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = data.map(v => `
        <tr class="hover:bg-slate-50/50 transition-colors">
            <td class="px-6 py-4">
                <span class="text-xs font-bold text-blue-600">${escapeHtml(v.ordinance_no || 'N/A')}</span>
            </td>
            <td class="px-6 py-4 font-bold text-slate-700 text-xs">${escapeHtml(v.violation_name || 'N/A')}</td>
            <td class="px-4 py-4 text-center">
                <span class="text-xs font-bold text-amber-600">₱${Number(v.first_offense || 0).toLocaleString()}</span>
            </td>
            <td class="px-4 py-4 text-center">
                <span class="text-xs font-bold text-orange-600">₱${Number(v.second_offense || 0).toLocaleString()}</span>
            </td>
            <td class="px-4 py-4 text-center">
                <span class="text-xs font-bold text-red-600">₱${Number(v.third_offense || 0).toLocaleString()}</span>
            </td>
            <td class="px-6 py-4 text-xs text-slate-400">${formatDate(v.created_at)}</td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="openEditModal(${v.id})" 
                        class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-all"
                        title="Edit">
                        <i class="bi bi-pencil-fill text-xs"></i>
                    </button>
                    <button onclick="openDeleteModal(${v.id})"
                        class="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all"
                        title="Delete">
                        <i class="bi bi-trash-fill text-xs"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ═══════════════════════════════════════════════════════════
// UPDATE STATS
// ═══════════════════════════════════════════════════════════
function updateStats(data) {
    // Total ordinances
    document.getElementById('statTotalOrdinances').textContent = data.length;

    // Penalty range (all offenses combined)
    if (data.length > 0) {
        const allAmounts = [];
        data.forEach(v => {
            const f = Number(v.first_offense || 0);
            const s = Number(v.second_offense || 0);
            const t = Number(v.third_offense || 0);
            if (f > 0) allAmounts.push(f);
            if (s > 0) allAmounts.push(s);
            if (t > 0) allAmounts.push(t);
        });
        
        if (allAmounts.length > 0) {
            const min = Math.min(...allAmounts);
            const max = Math.max(...allAmounts);
            document.getElementById('statPenaltyRange').textContent = 
                `₱${min.toLocaleString()} - ₱${max.toLocaleString()}`;
        } else {
            document.getElementById('statPenaltyRange').textContent = '₱0 - ₱0';
        }
    } else {
        document.getElementById('statPenaltyRange').textContent = '₱0 - ₱0';
    }

    // Last updated
    if (data.length > 0) {
        const dates = data.map(v => new Date(v.created_at)).filter(d => !isNaN(d));
        if (dates.length > 0) {
            const latest = new Date(Math.max(...dates));
            document.getElementById('statLastUpdated').textContent = 
                latest.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        } else {
            document.getElementById('statLastUpdated').textContent = '—';
        }
    } else {
        document.getElementById('statLastUpdated').textContent = '—';
    }
}

// ═══════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════
document.getElementById('searchInput').addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (query === '') {
        renderTable(violationsData);
        return;
    }

    const filtered = violationsData.filter(v => 
        (v.ordinance_no || '').toLowerCase().includes(query) ||
        (v.violation_name || '').toLowerCase().includes(query)
    );
    renderTable(filtered);
});

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', month: 'short', day: '2-digit' 
        });
    } catch {
        return dateStr;
    }
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    loadViolations();
});