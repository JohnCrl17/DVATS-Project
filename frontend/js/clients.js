/**
 * LTO Dasma - Clients Management Script
 * Updated: Match with dvats_api folder and HeidiSQL structure
 */

// 1. Siguraduhin na ito ang active Ngrok URL mo
// Gawin mo itong ganito:
const API_BASE_URL = 'https://dvats-project.onrender.com/api';

document.addEventListener('DOMContentLoaded', () => {
    loadClients();
    initSearch();
    initSidebar();
    initLogout();
});

// --- LOAD TABLE ---
async function loadClients() {
    try {
        // ✅ FIXED: Tinanggal extra /api
        const response = await fetch(`${API_BASE_URL}/web-clients/list`, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error("Network response was not ok");

        const clients = await response.json();
        const tableBody = document.getElementById('clientsTableBody');
        
        if (!clients || clients.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-20 text-slate-400 italic font-bold">No client records found.</td></tr>';
            return;
        }

        tableBody.innerHTML = clients.map(c => `
            <tr class="hover:bg-slate-50/80 transition-all border-b border-slate-50">
                <td class="px-10 py-6 text-lto-green font-mono text-xs font-black italic">#${c.client_id}</td>
                <td class="px-10 py-6">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lto-dark font-black shadow-sm uppercase">
                            ${c.fullname ? c.fullname.charAt(0) : '?'}
                        </div>
                        <span class="uppercase italic tracking-tight text-slate-800 font-bold">${c.fullname}</span>
                    </div>
                </td>
                <td class="px-10 py-6">
                    <span class="px-4 py-1.5 bg-green-50 text-lto-green border border-green-100 rounded-lg text-[11px] font-black italic shadow-sm">
                        ${c.license_no || 'N/A'}
                    </span>
                </td>
                <td class="px-10 py-6 text-slate-400 font-bold">${c.phone_number || 'N/A'}</td>
                <td class="px-10 py-6 text-right">
                    <div class="flex justify-end gap-3">
                        <button onclick="openSMSModal('${c.phone_number}', '${c.fullname}')" title="Send SMS" class="w-10 h-10 bg-slate-50 text-slate-400 hover:bg-amber-500 hover:text-white rounded-xl transition-all flex items-center justify-center shadow-inner">
                            <i class="bi bi-chat-left-dots"></i>
                        </button>
                        <button onclick="viewClient(${c.client_id})" title="View Details" class="w-10 h-10 bg-slate-50 text-slate-400 hover:bg-lto-green hover:text-white rounded-xl transition-all flex items-center justify-center shadow-inner">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button onclick="deleteClient(${c.client_id})" title="Delete" class="w-10 h-10 bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white rounded-xl transition-all flex items-center justify-center shadow-inner">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error("Load Error:", error);
        const tableBody = document.getElementById('clientsTableBody');
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-20 text-red-400 font-bold">Error loading data.</td></tr>';
    }
}

// --- VIEW PROFILE (THE MATA FEATURE) ---
async function viewClient(id) {
    if (!id || id === 'undefined') return;

    try {
        // ✅ FIXED: Tinanggal extra /api sa parehong fetch
        const [clientRes, historyRes] = await Promise.all([
            fetch(`${API_BASE_URL}/web-clients/details?id=${id}`, {
                headers: { 'Content-Type': 'application/json' }
            }),
            fetch(`${API_BASE_URL}/web-clients/history?id=${id}`, {
                headers: { 'Content-Type': 'application/json' }
            }).catch(() => null)
        ]);

        if (!clientRes.ok) throw new Error("Failed to fetch client details");

        const client = await clientRes.json();
        
        let history = [];
        if (historyRes && historyRes.ok) {
            history = await historyRes.json();
        }

        // --- POPULATE MODAL ---
        document.getElementById('view-name').innerText = client.fullname || 'Unknown';
        document.getElementById('view-id').innerText = `ID: #${client.client_id}`;
        document.getElementById('view-license').innerText = client.license_no || 'N/A';
        const dob = client.date_of_birth;
        const age = dob ? calculateAge(dob) : '--';

        document.getElementById('view-age-gender').innerText =
            `${dob || '--'} (${age}) / ${client.gender || '--'}`;
        document.getElementById('view-email').innerText = client.email || 'No Email';
        document.getElementById('view-phone').innerText = client.phone_number || 'No Number';
        document.getElementById('view-reg-date').innerText = client.reg_date || 'N/A';
        
        const faceImg = document.getElementById('view-face');
        const faceData = client.face_data || client.face_date;
        const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(client.fullname)}&background=107c10&color=fff`;
        
        faceImg.src = (faceData && faceData.length > 100) ? faceData : fallback;
        faceImg.onerror = () => { faceImg.src = fallback; };

        const historyList = document.getElementById('historyList');
        if (!history || history.length === 0) {
            historyList.innerHTML = `<p class="text-[11px] text-slate-400 italic">No violation records found.</p>`;
        } else {
            historyList.innerHTML = history.map(h => `
                <div class="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <div>
                        <div class="font-black text-slate-700 uppercase text-[11px] tracking-tighter">${h.violation_name}</div>
                        <small class="text-slate-400 font-bold">${h.created_at}</small>
                    </div>
                    <span class="px-3 py-1 rounded-lg text-[10px] font-black uppercase ${h.status === 'Paid' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
                        ${h.status}
                    </span>
                </div>
            `).join('');
        }

        document.getElementById('viewModalOverlay').classList.remove('hidden');

    } catch (err) {
        console.error("Detailed View Error:", err);
    }
}

// --- UTILS (SMS, DELETE, SEARCH) ---
// ✅ SMS Modal
let currentSMSPhone = '';

function openSMSModal(phone, name) {
  if (!phone || phone === 'null' || phone === 'N/A') {
    return showToastMsg("❌ No valid phone number found.", 'error');
  }
  const defaultMsg = `DVATS VIOLATIONS NOTICE: You have an outstanding traffic violation. Access the DVATS Portal immediately to view and settle your dues: https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/driver-portal/index.html. 

DVATS`;
  currentSMSPhone = phone;
  document.getElementById('smsModalName').innerText = name;
  document.getElementById('smsModalPhone').innerText = phone;
  document.getElementById('smsModalMessage').value = defaultMsg;
  document.getElementById('smsModalOverlay').classList.remove('hidden');
}

function closeSMSModal() {
  document.getElementById('smsModalOverlay').classList.add('hidden');
}

async function confirmSendSMS() {
  const msg = document.getElementById('smsModalMessage').value.trim();
  if (!msg) return;
  closeSMSModal();
  try {
    // ✅ FIXED: Tinanggal extra /api
    const res = await fetch(`${API_BASE_URL}/web-clients/send-sms`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ number: currentSMSPhone, message: msg })
    });
    
    const result = await res.json();
    if (result.success) {
      showToastMsg("✅ SMS Sent Successfully!");
    } else {
      showToastMsg("❌ Failed to send SMS.", 'error');
    }
  } catch (e) {
    showToastMsg("❌ Server Error.", 'error');
  }
}

// ✅ Delete Modal
let currentDeleteId = null;

function deleteClient(clientId) {
  currentDeleteId = clientId;
  document.getElementById('deleteModalOverlay').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('deleteModalOverlay').classList.add('hidden');
}

async function confirmDelete() {
    if (!currentDeleteId) return;
    closeDeleteModal();
    try {
        // ✅ FIXED: Tinanggal extra /api
        const response = await fetch(`${API_BASE_URL}/web-clients/delete`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ id: currentDeleteId })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            showToastMsg("✅ Client Deleted!");
            loadClients();
        } else {
            showToastMsg("⚠️ " + (data.message || "Failed to delete"), 'error');
        }
    } catch (error) {
        showToastMsg("❌ Server Error.", 'error');
    }
}

// ✅ Toast — para sa success/error messages
function showToastMsg(message, type = 'success') {
  const existing = document.getElementById('clientToast');
  if (existing) existing.remove();
  const colors = { success: 'bg-emerald-500', error: 'bg-red-500' };
  const toast = document.createElement('div');
  toast.id = 'clientToast';
  toast.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[99999] px-5 py-3 rounded-2xl text-white text-xs font-bold shadow-xl ${colors[type]}`;
  toast.style.cssText = 'opacity:0; transform:translateX(-50%) translateY(-10px); transition:all 0.3s ease;';
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; }, 10);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}


function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleBtn = document.getElementById('sidebarToggle');
    
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            if(mainContent) mainContent.classList.toggle('main-expanded');
        });
    }
}
// ✅ SEARCH FUNCTION
function initSearch() {
    const searchInput = document.getElementById('clientSearch');
    const tableBody = document.getElementById('clientsTableBody');

    if (!searchInput || !tableBody) return;

    searchInput.addEventListener('keyup', () => {
        const keyword = searchInput.value.toLowerCase();
        const rows = tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const text = row.innerText.toLowerCase();

            if (text.includes(keyword)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Confirm Logout from System?")) {
                localStorage.clear(); 
                window.location.href = 'login.html'; 
            }
        });
    }
}

function printIDCard() {
    const name = document.getElementById('view-name').innerText;
    const license = document.getElementById('view-license').innerText;
    const face = document.getElementById('view-face').src;
    const printWindow = window.open('', '_blank');
    
    if(!printWindow) return alert("Please allow popups for printing.");

    printWindow.document.write(`
        <html>
        <head>
            <title>Print ID - ${name}</title>
            <style>
                body { font-family: Arial; display:flex; justify-content:center; padding:50px; background: #f4f4f4; }
                .id-card { width:320px; border:5px solid #107c10; padding:25px; border-radius:20px; text-align:center; background:white; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
                .lto-header { color:#107c10; margin-bottom:15px; font-weight: 900; letter-spacing: -1px; }
                .profile-img { width:160px; height:160px; object-fit:cover; border-radius:15px; border:3px solid #eee; margin-bottom: 15px; }
                .name { text-transform:uppercase; margin: 10px 0; font-size: 1.4rem; color: #333; }
                .license { font-family:monospace; font-weight:bold; font-size:1.3rem; background: #e8f5e9; padding: 5px 10px; color: #107c10; border-radius: 8px; }
            </style>
        </head>
        <body>
            <div class="id-card">
                <h2 class="lto-header">LTO DASMA</h2>
                <img src="${face}" class="profile-img">
                <h3 class="name">${name}</h3>
                <p class="license">${license}</p>
            </div>
            <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
        </html>
    `);
}

// Function para isara ang modal
function closeModal() {
    const modal = document.getElementById('viewModalOverlay');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// OPTIONAL: Isara ang modal kapag cliniclick ang labas (overlay)
window.onclick = function(event) {
    const modal = document.getElementById('viewModalOverlay');
    if (event.target == modal) {
        closeModal();
    }
}