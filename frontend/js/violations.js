// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════
const API_BASE_URL = "https://dvats-project.onrender.com/api";

function getImageUrl(originalUrl) {
    if (!originalUrl || originalUrl === '') return '';
    let path = originalUrl;
    if (path.includes('//')) {
        const parts = path.split('/dvats_api/');
        path = parts.length > 1 ? parts[1] : path;
    }
    path = path.replace(/^\//, '');
    return `${API_BASE_URL}/api/web-violations/serve-image?path=${encodeURIComponent(path)}`;
}

async function fetchImageAsBlob(url) {
    try {
        const res = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
        if (!res.ok) throw new Error('Failed');
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    } catch (e) {
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initPSTClock();
    loadViolations();
    loadClientDropdown();

    const violationTypeSelect = document.getElementById('violationType');
    if (violationTypeSelect) {
        violationTypeSelect.addEventListener('change', function () {
            const selectedOption = this.options[this.selectedIndex];
            const price = selectedOption.getAttribute('data-price');
            const penaltyInput = document.getElementById('penaltyAmount');
            if (penaltyInput) penaltyInput.value = price || 0;
        });
    }

    const saveBtn = document.getElementById('btnSaveViolation');
    if (saveBtn) saveBtn.addEventListener('click', saveViolation);

    const searchInput = document.getElementById('violationSearch');
    const filterSelect = document.getElementById('violationFilter');
    const monthInput = document.getElementById('monthFilter');

    if (searchInput) searchInput.addEventListener('input', filterTable);
    if (filterSelect) filterSelect.addEventListener('change', filterTable);
    if (monthInput) monthInput.addEventListener('change', filterTable);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeImagePreview();
    });

    const imagePreviewModal = document.getElementById('imagePreviewModal');
    if (imagePreviewModal) {
        imagePreviewModal.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeImagePreview();
        });
    }
});

// ═══════════════════════════════════════════════════════════
// FETCH & RENDER VIOLATIONS
// ═══════════════════════════════════════════════════════════
async function loadViolations() {
    const tbody = document.getElementById('violationsTableBody');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/web-violations/list`, {
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        tbody.innerHTML = '';
        const violationList = Array.isArray(data) ? data : (data.violations || []);

        if (violationList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-8 py-16 text-center">
                        <div class="flex flex-col items-center gap-3">
                            <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                                <i class="bi bi-inbox text-2xl text-slate-300"></i>
                            </div>
                            <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">No Records Found</p>
                        </div>
                    </td>
                </tr>`;
            if (typeof updateDashboardStats === 'function') updateDashboardStats([]);
            return;
        }

        for (const v of violationList) {
            const violationId = parseInt(v.id, 10) || null;
            const isPaid = v.status?.toUpperCase() === 'PAID';
            const statusIcon = isPaid ? 'check-circle' : 'alert-circle';
            const statusColor = isPaid ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50';

            const dateIssued = v.created_at || 'N/A';
            const driver = v.driver_name || 'Unknown';
            const badge = v.badge_number || '---';
            const violation = v.violation_name || 'N/A';
            const amount = parseFloat(v.fine_amount) || 0;
            const dateForFilter = dateIssued.split(' ')[0];

            const hasViolationPhoto = v.violation_photo && v.violation_photo !== '';
            const hasEnforcerProof = v.enforcer_proof && v.enforcer_proof !== '';

            let evidenceHTML = '<div class="flex items-center gap-2">';

            if (hasViolationPhoto) {
                evidenceHTML += `
                    <button class="vphoto-btn w-12 h-12 rounded-xl bg-slate-200 overflow-hidden border-2 border-slate-300 hover:border-red-400 transition-all flex-shrink-0 relative group"
                        data-url="${getImageUrl(v.violation_photo)}"
                        data-title="Violation Evidence"
                        data-label="Ticket #${escapeHtml(v.ticket_no || String(violationId))}">
                        <img src="${getImageUrl(v.violation_photo)}" class="w-full h-full object-cover">
                    </button>`;
            }

            if (hasEnforcerProof) {
                evidenceHTML += `
                    <button class="vphoto-btn w-12 h-12 rounded-xl bg-slate-200 overflow-hidden border-2 border-slate-300 hover:border-blue-400 transition-all flex-shrink-0 relative group"
                        data-url="${getImageUrl(v.enforcer_proof)}"
                        data-title="Enforcer Proof"
                        data-label="${escapeHtml(v.proof_type || 'Manual')}">
                        <img src="${getImageUrl(v.enforcer_proof)}" class="w-full h-full object-cover">
                    </button>`;
            }

            if (!hasViolationPhoto && !hasEnforcerProof) {
                evidenceHTML += `
                    <div class="w-12 h-12 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
                        <i class="bi bi-camera-off text-slate-300 text-lg"></i>
                    </div>`;
            }

            evidenceHTML += '</div>';

            const row = document.createElement('tr');
            row.className = 'violation-row hover:bg-slate-50/50 transition-colors border-b border-slate-50';
            row.setAttribute('data-status', (isPaid ? 'paid' : 'pending'));
            row.setAttribute('data-date', dateForFilter);

            row.innerHTML = `
                <td class="px-8 py-4 font-mono text-[11px] text-slate-400">${escapeHtml(dateIssued)}</td>
                <td class="px-6 py-4">
                    <div class="font-black text-slate-700 uppercase tracking-tighter text-xs">${escapeHtml(driver)}</div>
                    <div class="text-[9px] text-slate-400 font-bold uppercase">TICKET: ${escapeHtml(v.ticket_no || 'TKT-PENDING')}</div>
                </td>
                <td class="px-6 py-4 font-bold text-blue-600 text-xs">${escapeHtml(badge)}</td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase border border-slate-200">
                        ${escapeHtml(violation)}
                    </span>
                </td>
                <td class="px-6 py-4">${evidenceHTML}</td>
                <td class="px-6 py-4 font-black text-xs text-red-600">₱${amount.toLocaleString()}</td>
                <td class="px-6 py-4">
                    <span class="flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase ${statusColor} w-max">
                        <i data-lucide="${statusIcon}" class="w-3 h-3"></i>
                        ${v.status || 'PENDING'}
                    </span>
                </td>
                <td class="px-8 py-4 text-right">
                    ${!isPaid
                        ? `<button class="settle-btn px-3 py-1 bg-[#107c10] text-white rounded-lg text-[10px] uppercase font-black hover:bg-[#0a5a0a] transition-all shadow-sm" data-id="${violationId}">Settle</button>`
                        : `<span class="text-slate-300 italic text-[10px] font-bold">✓ CLEARED</span>`
                    }
                </td>`;

            tbody.appendChild(row);

            const settleBtn = row.querySelector('.settle-btn');
            if (settleBtn) {
                settleBtn.addEventListener('click', () => settleViolation(violationId));
            }

            row.querySelectorAll('.vphoto-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    openImagePreview(btn.getAttribute('data-url'), btn.getAttribute('data-title'), btn.getAttribute('data-label'));
                });
            });
        }

        if (typeof updateDashboardStats === 'function') updateDashboardStats(violationList);
        if (typeof lucide !== 'undefined') setTimeout(() => lucide.createIcons(), 100);

    } catch (err) {
        console.error("Table Load Error:", err);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-red-500">Failed to connect to API.</td></tr>`;
    }
}

function loadThumbnails() {
    const images = document.querySelectorAll('img[data-ngrok-src]');
    images.forEach(async (imgEl) => {
        const src = imgEl.getAttribute('data-ngrok-src');
        if (!src) return;
        const blobUrl = await fetchImageAsBlob(src);
        if (blobUrl) {
            imgEl.src = blobUrl;
        } else {
            imgEl.style.display = 'none';
        }
    });
}

function openImagePreview(imageUrl, title, label) {
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('imagePreviewSrc');
    const titleEl = document.getElementById('imagePreviewTitle');
    const labelEl = document.getElementById('imagePreviewLabel');
    const downloadLink = document.getElementById('imageDownloadLink');
    const spinner = document.getElementById('previewSpinner');
    const iconWrap = document.getElementById('previewIconWrap');
    const icon = document.getElementById('previewIcon');

    if (!modal || !img) return;

    titleEl.textContent = title || 'Evidence Photo';
    labelEl.textContent = label || '';

    if (title?.toLowerCase().includes('enforcer')) {
        iconWrap.style.background = '#1e3a8a';
        icon.className = 'bi bi-person-badge-fill text-lg text-blue-300';
    } else {
        iconWrap.style.background = '#7f1d1d';
        icon.className = 'bi bi-camera-fill text-lg text-red-300';
    }

    img.style.opacity = '0';
    img.src = '';
    if (spinner) spinner.style.display = 'flex';
    if (downloadLink) downloadLink.style.display = 'none';

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (imageUrl) {
        fetch(imageUrl, { headers: { 'ngrok-skip-browser-warning': 'true' } })
        .then(res => { if (!res.ok) throw new Error(); return res.blob(); })
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            img.src = blobUrl;
            img.onload = () => {
                if (spinner) spinner.style.display = 'none';
                img.style.opacity = '1';
            };
            if (downloadLink) {
                downloadLink.href = blobUrl;
                downloadLink.download = `evidence_${Date.now()}.jpg`;
                downloadLink.style.display = 'flex';
            }
        })
        .catch(() => {
            if (spinner) spinner.style.display = 'none';
            img.src = '';
            img.style.opacity = '1';
        });
    }
}

function closeImagePreview() {
    const modal = document.getElementById('imagePreviewModal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

function updateDashboardStats(violationList) {
    const statTotal = document.getElementById('statTotalPenalties');
    const statUnpaid = document.getElementById('statUnpaidTickets');
    const statSettled = document.getElementById('statSettledToday');

    if (!statTotal) return;

    let totalFine = 0;
    let unpaidCount = 0;
    let settledTodayCount = 0;

    const today = new Date().toISOString().split('T')[0];

    violationList.forEach(v => {
        const amount = parseFloat(v.fine_amount) || 0;
        totalFine += amount;
        if (v.status?.toUpperCase() !== 'PAID') unpaidCount++;
        if (v.status?.toUpperCase() === 'PAID' && v.updated_at?.includes(today)) {
            settledTodayCount++;
        }
    });

    statTotal.innerText = `₱${totalFine.toLocaleString()}`;
    statUnpaid.innerText = `${unpaidCount} Pending`;
    statSettled.innerText = `${settledTodayCount} Cleared`;
}

async function loadClientDropdown() {
    const select = document.getElementById('clientSelect');
    if (!select) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/web-clients/list`, {
            headers: { 'Content-Type': 'application/json' }
        });
        const clients = await response.json();

        select.innerHTML = '<option value="">-- Choose Driver --</option>';
        if (Array.isArray(clients)) {
            clients.forEach(c => {
                select.innerHTML += `<option value="${c.client_id}">${escapeHtml(c.fullname).toUpperCase()}</option>`;
            });
        }
    } catch (err) {
        console.error("Dropdown Load Error:", err);
        select.innerHTML = '<option value="">⚠️ Server Offline</option>';
    }
}

async function saveViolation() {
    const btn = document.getElementById('btnSaveViolation');
    const clientId = document.getElementById('clientSelect')?.value;
    const vType = document.getElementById('violationType')?.value;
    const amount = document.getElementById('penaltyAmount')?.value || 0;

    if (!clientId || !vType) {
        showViolationToast("⚠️ Please select a driver and violation!", "error");
        return;
    }

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Processing...`;

    try {
        const response = await fetch(`${API_BASE_URL}/api/web-violations/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: clientId,
                violation_type: vType,
                penalty_amount: amount
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            const modalEl = document.getElementById('addViolationModal');
            if (window.bootstrap && modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal?.hide();
            }
            document.getElementById('violationForm')?.reset();
            loadViolations();
            showViolationToast("✅ Violation successfully recorded!");
        } else {
            showViolationToast("⚠️ Error: " + (result.message || "Unknown error"), "error");
        }
    } catch (err) {
        console.error("SaveViolation Error:", err);
        showViolationToast("❌ Server Error. Please try again.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ═══════════════════════════════════════════════════════════
// SETTLE PAYMENT
// ═══════════════════════════════════════════════════════════
let currentSettleId = null;

function settleViolation(id) {
    currentSettleId = id;
    const modal = document.getElementById('settleModalOverlay');
    if (modal) modal.classList.remove('hidden');
}

function closeSettleModal() {
    const modal = document.getElementById('settleModalOverlay');
    if (modal) modal.classList.add('hidden');
    currentSettleId = null;
}

async function confirmSettle() {
    if (!currentSettleId) return;

    const idToSettle = currentSettleId;
    closeSettleModal();

    try {
        const response = await fetch(`${API_BASE_URL}/api/web-violations/settle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: idToSettle })
        });
        
        const result = await response.json();
        if (result.status === 'success') {
            showViolationToast("✅ Violation settled successfully!");
            loadViolations();
        } else {
            showViolationToast("⚠️ Error: " + (result.message || 'Unknown error'), 'error');
        }
    } catch (err) {
        console.error("Settle Error:", err);
        showViolationToast("❌ Failed to connect to server.", 'error');
    }
}

// ═══════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════
let toastTimeout = null;

function showViolationToast(message, type = 'success') {
    const colors = { success: 'bg-emerald-500', error: 'bg-red-500', warning: 'bg-amber-500' };
    const toast = document.getElementById('violationToast');
    if (!toast) return;

    if (toastTimeout) clearTimeout(toastTimeout);

    toast.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[99999] px-5 py-3 rounded-2xl text-white text-xs font-bold shadow-xl transition-all ${colors[type] || colors.success}`;
    toast.innerText = message;
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);

    toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

// ═══════════════════════════════════════════════════════════
// FILTER TABLE
// ═══════════════════════════════════════════════════════════
function filterTable() {
    const searchText = document.getElementById('violationSearch')?.value.toLowerCase() || '';
    const statusValue = document.getElementById('violationFilter')?.value.toLowerCase() || 'all';
    const monthValue = document.getElementById('monthFilter')?.value || '';

    const rows = document.querySelectorAll('.violation-row');
    let visibleCount = 0;

    rows.forEach(row => {
        const status = row.getAttribute('data-status');
        const date = row.getAttribute('data-date');
        const rowText = row.innerText.toLowerCase();

        let matchesStatus = (statusValue === 'all');
        if (statusValue === 'unpaid') matchesStatus = (status === 'pending');
        else if (statusValue === 'paid') matchesStatus = (status === 'paid');

        const matchesSearch = rowText.includes(searchText);
        const matchesMonth = (monthValue === '' || (date && date.startsWith(monthValue)));

        if (matchesSearch && matchesStatus && matchesMonth) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const tbody = document.getElementById('violationsTableBody');
    let noResultMsg = document.getElementById('noResultRow');

    if (visibleCount === 0 && rows.length > 0) {
        if (!noResultMsg) {
            const tr = document.createElement('tr');
            tr.id = 'noResultRow';
            tr.innerHTML = `<td colspan="8" class="text-center py-10 text-slate-400 font-bold uppercase tracking-widest"><i class="bi bi-search"></i> No matching records found</td>`;
            if (tbody) tbody.appendChild(tr);
        }
    } else if (noResultMsg) {
        noResultMsg.remove();
    }
}

// ═══════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════
function initPSTClock() {
    const timeElement = document.getElementById('pst-time');
    if (!timeElement) return;
    const updateTime = () => {
        const options = {
            timeZone: 'Asia/Manila',
            weekday: 'short', month: 'short', day: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        };
        timeElement.textContent = new Intl.DateTimeFormat('en-US', options).format(new Date());
    };
    updateTime();
    setInterval(updateTime, 1000);
}

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const mainContent = document.getElementById('mainContent');

    if (toggleBtn && sidebar && mainContent) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('main-expanded');
        });
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}