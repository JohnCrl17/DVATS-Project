/**
 * LTO Appointments Management System
 * Full JS Implementation
 */

// ─────────────────────────────────────────────────────────────
// ALERT SYSTEM — Modern Minimalist
// ─────────────────────────────────────────────────────────────

const Alert = (() => {
  // Inject styles once
  const injectStyles = () => {
    if (document.getElementById('alert-styles')) return;
    const style = document.createElement('style');
    style.id = 'alert-styles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

      .alert-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        animation: alertFadeIn 0.18s ease;
      }

      @keyframes alertFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      @keyframes alertSlideUp {
        from { opacity: 0; transform: translateY(12px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0)    scale(1);    }
      }

      @keyframes alertSlideOut {
        from { opacity: 1; transform: translateY(0)   scale(1);    }
        to   { opacity: 0; transform: translateY(8px) scale(0.97); }
      }

      .alert-box {
        background: #ffffff;
        border-radius: 20px;
        width: 100%;
        max-width: 360px;
        overflow: hidden;
        box-shadow:
          0 0 0 1px rgba(15,23,42,0.06),
          0 8px 24px rgba(15,23,42,0.10),
          0 32px 64px rgba(15,23,42,0.08);
        font-family: 'DM Sans', sans-serif;
        animation: alertSlideUp 0.22s cubic-bezier(0.34,1.3,0.64,1);
      }

      .alert-box.closing {
        animation: alertSlideOut 0.18s ease forwards;
      }

      .alert-body {
        padding: 28px 24px 20px;
        text-align: center;
      }

      .alert-icon {
        width: 52px;
        height: 52px;
        border-radius: 16px;
        margin: 0 auto 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .alert-icon.success { background: #f0fdf4; }
      .alert-icon.error   { background: #fef2f2; }
      .alert-icon.warning { background: #fffbeb; }
      .alert-icon.info    { background: #eff6ff; }

      .alert-title {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 6px;
        letter-spacing: -0.3px;
        line-height: 1.3;
      }

      .alert-message {
        font-size: 13px;
        color: #64748b;
        margin: 0;
        font-weight: 500;
        line-height: 1.55;
      }

      .alert-actions {
        border-top: 1px solid #f1f5f9;
        display: flex;
      }

      .alert-btn {
        flex: 1;
        padding: 16px;
        border: none;
        background: none;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        font-family: 'DM Sans', sans-serif;
        transition: background 0.15s ease;
        letter-spacing: -0.1px;
      }

      .alert-btn:hover { background: #f8fafc; }
      .alert-btn:active { background: #f1f5f9; }

      .alert-btn + .alert-btn {
        border-left: 1px solid #f1f5f9;
      }

      .alert-btn.cancel  { color: #94a3b8; }
      .alert-btn.confirm { color: #0f172a; }
      .alert-btn.danger  { color: #ef4444; }
      .alert-btn.primary { color: #007aff; }

      /* Toast styles */
      .alert-toast-wrap {
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        pointer-events: none;
      }

      .alert-toast {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 18px;
        border-radius: 100px;
        font-family: 'DM Sans', sans-serif;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 20px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.05);
        animation: toastIn 0.28s cubic-bezier(0.34,1.4,0.64,1);
        letter-spacing: -0.1px;
        pointer-events: auto;
        white-space: nowrap;
      }

      @keyframes toastIn {
        from { opacity: 0; transform: translateY(-10px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0)     scale(1);    }
      }

      @keyframes toastOut {
        from { opacity: 1; transform: translateY(0)    scale(1);    }
        to   { opacity: 0; transform: translateY(-8px) scale(0.96); }
      }

      .alert-toast.hiding {
        animation: toastOut 0.2s ease forwards;
      }

      .alert-toast.success { background: #0f172a; color: #ffffff; }
      .alert-toast.error   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
      .alert-toast.warning { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
      .alert-toast.info    { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
    `;
    document.head.appendChild(style);
  };

  // Close helper with animation
  const closeBox = (overlay, box, resolve, value) => {
    box.classList.add('closing');
    setTimeout(() => { overlay.remove(); if (resolve) resolve(value); }, 160);
  };

  // ── Toast (auto-dismiss, no buttons)
  const toast = (message, type = 'success', duration = 2800) => {
    injectStyles();

    let wrap = document.getElementById('alert-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'alert-toast-wrap';
      wrap.className = 'alert-toast-wrap';
      document.body.appendChild(wrap);
    }

    const icons = {
      success: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      error:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
      warning: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };

    const t = document.createElement('div');
    t.className = `alert-toast ${type}`;
    t.innerHTML = `${icons[type] || ''}<span>${message}</span>`;
    wrap.appendChild(t);

    setTimeout(() => {
      t.classList.add('hiding');
      setTimeout(() => t.remove(), 200);
    }, duration);
  };

  // ── Alert (single OK button)
  const alert = (title, message, type = 'info') => {
    injectStyles();

    const icons = {
      success: { svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` },
      error:   { svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>` },
      warning: { svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` },
      info:    { svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>` },
    };

    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';
      overlay.innerHTML = `
        <div class="alert-box">
          <div class="alert-body">
            <div class="alert-icon ${type}">${icons[type]?.svg || ''}</div>
            <p class="alert-title">${title}</p>
            ${message ? `<p class="alert-message">${message}</p>` : ''}
          </div>
          <div class="alert-actions">
            <button class="alert-btn primary" id="alertOk">OK</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const box = overlay.querySelector('.alert-box');
      overlay.querySelector('#alertOk').onclick = () => closeBox(overlay, box, resolve, true);
      overlay.addEventListener('click', e => { if (e.target === overlay) closeBox(overlay, box, resolve, true); });
    });
  };

  // ── Confirm (two buttons, returns boolean)
  const confirm = (title, message, opts = {}) => {
    injectStyles();

    const {
      confirmText  = 'Confirm',
      cancelText   = 'Cancel',
      confirmStyle = 'danger',   // 'danger' | 'primary'
      icon         = 'warning',
    } = opts;

    const icons = {
      warning: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      danger:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      info:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };

    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';
      overlay.innerHTML = `
        <div class="alert-box">
          <div class="alert-body">
            <div class="alert-icon ${icon === 'danger' ? 'error' : 'warning'}">${icons[icon] || icons.warning}</div>
            <p class="alert-title">${title}</p>
            ${message ? `<p class="alert-message">${message}</p>` : ''}
          </div>
          <div class="alert-actions">
            <button class="alert-btn cancel"  id="alertCancel">${cancelText}</button>
            <button class="alert-btn ${confirmStyle}" id="alertConfirm">${confirmText}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const box = overlay.querySelector('.alert-box');
      overlay.querySelector('#alertCancel').onclick  = () => closeBox(overlay, box, resolve, false);
      overlay.querySelector('#alertConfirm').onclick = () => closeBox(overlay, box, resolve, true);
      overlay.addEventListener('click', e => { if (e.target === overlay) closeBox(overlay, box, resolve, false); });
    });
  };

  return { toast, alert, confirm };
})();


// ─────────────────────────────────────────────────────────────
// SEMAPHORE SMS
// ─────────────────────────────────────────────────────────────

const SMS = (() => {

  // Gamitin ang existing send_sms.php — API key naka-store na doon
  const send = async (number, message) => {
    const res = await fetch(`${API_BASE_URL}/web-appointments/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ number, message }),
    });
    
    const data = await res.json();
    if (!data.success) throw new Error(data.error || data.message || 'SMS failed');
    return data;
};

  // Show SMS preview modal — returns Promise<boolean>
  const preview = (recipientName, phoneNumber, message) => {
    // Inject extra styles if needed
    const styleId = 'sms-preview-styles';
    if (!document.getElementById(styleId)) {
      const s = document.createElement('style');
      s.id = styleId;
      s.textContent = `
        .sms-preview-box {
          background: #ffffff;
          border-radius: 20px;
          width: 100%;
          max-width: 400px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(15,23,42,0.06),
            0 8px 24px rgba(15,23,42,0.10),
            0 32px 64px rgba(15,23,42,0.08);
          font-family: 'DM Sans', sans-serif;
          animation: alertSlideUp 0.22s cubic-bezier(0.34,1.3,0.64,1);
        }
        .sms-preview-header {
          padding: 24px 24px 0;
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }
        .sms-preview-icon {
          width: 44px; height: 44px;
          border-radius: 14px;
          background: #f0fdf4;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .sms-preview-meta { flex: 1; }
        .sms-preview-title {
          font-size: 15px; font-weight: 700;
          color: #0f172a; margin: 0 0 3px;
          letter-spacing: -0.3px;
        }
        .sms-preview-sub {
          font-size: 12px; color: #94a3b8;
          font-weight: 500; margin: 0;
        }
        .sms-preview-body { padding: 16px 24px 8px; }
        .sms-preview-bubble-wrap {
          background: #f8fafc;
          border-radius: 14px;
          padding: 14px 16px;
          border: 1px solid #f1f5f9;
        }
        .sms-preview-label {
          font-size: 10px; font-weight: 700;
          color: #94a3b8; letter-spacing: 0.6px;
          text-transform: uppercase; margin-bottom: 8px;
        }
        .sms-preview-bubble {
          background: #0f172a;
          color: #ffffff;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.6;
          padding: 12px 14px;
          border-radius: 12px 12px 12px 3px;
          margin: 0;
          letter-spacing: -0.1px;
        }
        .sms-preview-chars {
          text-align: right;
          font-size: 11px;
          color: #cbd5e1;
          font-weight: 500;
          margin-top: 8px;
        }
        .sms-preview-recipient {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 24px 16px;
        }
        .sms-preview-recipient-label {
          font-size: 11px; color: #94a3b8; font-weight: 600;
        }
        .sms-preview-recipient-pill {
          display: flex; align-items: center; gap: 5px;
          background: #eff6ff; border-radius: 100px;
          padding: 4px 10px 4px 6px;
        }
        .sms-preview-recipient-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #3b82f6;
        }
        .sms-preview-recipient-name {
          font-size: 12px; font-weight: 700; color: #1d4ed8;
        }
        .sms-preview-recipient-num {
          font-size: 11px; color: #93c5fd; font-weight: 500;
        }
        .sms-preview-actions {
          border-top: 1px solid #f1f5f9;
          display: flex;
        }
      `;
      document.head.appendChild(s);
    }

    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';

      const charCount = message.length;
      const smsCount  = Math.ceil(charCount / 160);

      overlay.innerHTML = `
        <div class="sms-preview-box">
          <div class="sms-preview-header">
            <div class="sms-preview-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div class="sms-preview-meta">
              <p class="sms-preview-title">Send SMS Notification</p>
              <p class="sms-preview-sub">via DVATS · Semaphore</p>
            </div>
          </div>

          <div class="sms-preview-body">
            <div class="sms-preview-bubble-wrap">
              <p class="sms-preview-label">Message Preview</p>
              <p class="sms-preview-bubble">${message}</p>
              <p class="sms-preview-chars">${charCount} chars · ${smsCount} SMS credit${smsCount > 1 ? 's' : ''}</p>
            </div>
          </div>

          <div class="sms-preview-recipient">
            <span class="sms-preview-recipient-label">To</span>
            <div class="sms-preview-recipient-pill">
              <div class="sms-preview-recipient-dot"></div>
              <span class="sms-preview-recipient-name">${recipientName}</span>
              <span class="sms-preview-recipient-num">${phoneNumber}</span>
            </div>
          </div>

          <div class="sms-preview-actions">
            <button class="alert-btn cancel"  id="smsCancel">Skip SMS</button>
            <button class="alert-btn primary" id="smsSend">Send Now</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const box = overlay.querySelector('.sms-preview-box');
      const closeBox = (val) => {
        box.classList.add('closing');
        setTimeout(() => { overlay.remove(); resolve(val); }, 160);
      };

      overlay.querySelector('#smsCancel').onclick = () => closeBox(false);
      overlay.querySelector('#smsSend').onclick   = () => closeBox(true);
      overlay.addEventListener('click', e => { if (e.target === overlay) closeBox(false); });
    });
  };

  return { send, preview };
})();


// ─────────────────────────────────────────────────────────────
// APPOINTMENTS LOGIC
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    fetchAppointments();
    fetchClientsForDropdown();

    const saveBtn = document.getElementById('btnConfirmAppt');
    if (saveBtn) {
        saveBtn.addEventListener('click', addAppointment);
    }
});

// --- 1. SIDEBAR ---
function initSidebar() {
    const sidebar     = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleBtn   = document.getElementById('sidebarToggle');

    if (toggleBtn && sidebar && mainContent) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('main-expanded');
        });
    }
}

// --- 2. FETCH & DISPLAY APPOINTMENTS ---
async function fetchAppointments() {
    const tableBody = document.getElementById('appointmentsTableBody');
    if (!tableBody) return;

    try {
        const response = await fetch('/api/appointments/all');
        const results  = await response.json();

        if (!results || results.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-20">
                        <i class="bi bi-calendar-x text-5xl text-slate-200 block mb-3"></i>
                        <p class="text-slate-400 font-bold uppercase tracking-widest text-xs">No appointments scheduled</p>
                    </td>
                </tr>`;
            return;
        }

        tableBody.innerHTML = results.map(a => {
            const apptDate      = new Date(a.appointment_date);
            const formattedDate = apptDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
            const formattedTime = apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let statusBadge = '';
            const status    = a.status ? a.status.toLowerCase() : 'pending';

            if (status === 'scheduled' || status === 'approved') {
                statusBadge = `<span class="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-100">Scheduled</span>`;
            } else if (status === 'completed') {
                statusBadge = `<span class="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">Completed</span>`;
            } else {
                statusBadge = `<span class="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">${status}</span>`;
            }

            return `
                <tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                    <td class="px-8 py-4 text-slate-400 font-mono text-[11px]">#${a.appointment_id}</td>
                    <td class="px-6 py-4">
                        <div class="text-slate-800 font-extrabold uppercase tracking-tight text-sm">${a.fullname || 'Unknown Client'}</div>
                        <div class="text-[10px] text-slate-400 font-bold tracking-tighter">${a.license_no || 'NO LICENSE RECORD'}</div>
                    </td>
                    <td class="px-6 py-4 text-slate-600 text-xs">
                        <div class="flex items-center gap-2 font-bold">
                            <i class="bi bi-calendar-event text-blue-500"></i> ${formattedDate}
                        </div>
                        <div class="text-[11px] text-slate-400 flex items-center gap-2 mt-1 font-medium">
                            <i class="bi bi-clock"></i> ${formattedTime}
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="text-slate-500 font-bold text-[11px] uppercase tracking-tight">${a.purpose}</span>
                    </td>
                    <td class="px-6 py-4">${statusBadge}</td>
                    <td class="px-8 py-4 text-right">
                        <button onclick="deleteAppointment(${a.appointment_id})"
                                class="h-9 w-9 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error fetching appointments:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-red-500">Failed to load appointments.</td></tr>';
    }
}

// --- 3. LOAD CLIENTS FOR DROPDOWN ---
async function fetchClientsForDropdown() {
    const select = document.getElementById('clientSelect');
    if (!select) return;

    try {
        const response = await fetch('/api/clients/all');
        const clients  = await response.json();

        select.innerHTML = '<option value="" disabled selected>-- Choose Driver --</option>' +
        clients.map(c => `
            <option value="${c.client_id}"
                    data-name="${c.fullname}"
                    data-phone="${c.phone_number || ''}">
                ${c.fullname.toUpperCase()} (${c.license_no || 'No License'})
            </option>`).join('');
    } catch (error) {
        console.error('Error fetching clients for dropdown:', error);
        select.innerHTML = '<option value="">Failed to load drivers</option>';
    }
}

// --- 4. ADD NEW APPOINTMENT ---
async function addAppointment() {
    const btn      = document.getElementById('btnConfirmAppt');
    const clientId = document.getElementById('clientSelect').value;
    const date     = document.getElementById('apptDate').value;
    const time     = document.getElementById('apptTime').value;
    const purpose  = document.getElementById('apptPurpose').value;
    const shouldSendSMS = document.getElementById('sendSmsAppt').checked;

    if (!clientId || !date || !time) {
        // ✅ Modern alert — validation
        await Alert.alert('Missing Details', 'Please select a driver, date, and time before confirming.', 'warning');
        return;
    }

    btn.disabled   = true;
    const originalText = btn.innerHTML;
    btn.innerHTML  = '<span class="spinner-border spinner-border-sm me-2"></span>Confirming...';

    try {
        const combinedDateTime = `${date} ${time}:00`;

        const response = await fetch('/api/appointments/add', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                client_id:        clientId,
                appointment_date: combinedDateTime,
                purpose:          purpose,
                status:           'Scheduled',
            }),
        });

        const result = await response.json();

        if (result.success) {
            if (shouldSendSMS) {
                try {
                    const selectedOption = document.getElementById('clientSelect').selectedOptions[0];
                    const clientData = {
                        fullname:     selectedOption.dataset.name,
                        phone_number: selectedOption.dataset.phone
                    };

                    if (clientData.phone_number) {
                        // Format date nicely for the SMS message
                        const formattedDate = new Date(`${date} ${time}`).toLocaleDateString('en-PH', {
                            month: 'long', day: 'numeric', year: 'numeric'
                        });
                        const formattedTime = new Date(`${date} ${time}`).toLocaleTimeString('en-PH', {
                            hour: '2-digit', minute: '2-digit'
                        });

                        const msg = `APPOINTMENTS NOTICE: Hi ${clientData.fullname}, your appointment for ${purpose} is confirmed on ${formattedDate} at ${formattedTime}. Please bring required documents. Thank you!`;

                        // ✅ Show SMS preview modal — user can confirm or skip
                        const sendSms = await SMS.preview(clientData.fullname, clientData.phone_number, msg);

                        if (sendSms) {
                            try {
                                await SMS.send(clientData.phone_number, msg);
                                Alert.toast('SMS notification sent to ' + clientData.fullname, 'success');
                            } catch (smsErr) {
                                console.warn('SMS send failed:', smsErr);
                                await Alert.alert('SMS Failed', 'Appointment was saved but the SMS could not be sent. Check your Semaphore API key.', 'warning');
                            }
                        }
                    } else {
                        await Alert.alert('No Phone Number', `${clientData.fullname} has no phone number on record. SMS skipped.`, 'warning');
                    }
                } catch (smsError) {
                    console.warn('SMS flow error:', smsError);
                }
            }

            // ✅ Modern toast — success
            Alert.toast('Appointment scheduled successfully', 'success');
            setTimeout(() => location.reload(), 1400);

        } else {
            // ✅ Modern alert — server error
            await Alert.alert('Scheduling Failed', result.message || 'The server could not process this request.', 'error');
            btn.disabled  = false;
            btn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Critical Error:', error);
        // ✅ Modern alert — connection error
        await Alert.alert('Connection Error', 'Could not reach the server. Please check your connection and try again.', 'error');
        btn.disabled  = false;
        btn.innerHTML = originalText;
    }
}

// --- 5. DELETE/CANCEL APPOINTMENT ---
async function deleteAppointment(id) {
    // ✅ Modern confirm dialog
    const confirmed = await Alert.confirm(
        'Cancel Appointment',
        'Are you sure you want to cancel this appointment? This action cannot be undone.',
        {
            confirmText:  'Cancel Appointment',
            cancelText:   'Keep',
            confirmStyle: 'danger',
            icon:         'warning',
        }
    );

    if (!confirmed) return;

    try {
        const response = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
        if (response.ok) {
            // ✅ Toast on success
            Alert.toast('Appointment cancelled', 'success');
            setTimeout(() => fetchAppointments(), 800);
        } else {
            await Alert.alert('Delete Failed', 'Could not cancel this appointment. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error deleting appointment:', error);
        await Alert.alert('Connection Error', 'Could not reach the server.', 'error');
    }
}