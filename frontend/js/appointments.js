// ─────────────────────────────────────────────────────────────
// APPOINTMENTS LOGIC
// ─────────────────────────────────────────────────────────────

// ✅ DAGDAG: Kailangan ng API_BASE_URL sa taas ng file
const API_BASE_URL = 'https://dvats-project.onrender.com/api';

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
        // ✅ FIXED: Gumamit ng API_BASE_URL
        const response = await fetch(`${API_BASE_URL}/appointments/all`);
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
        // ✅ FIXED: Gumamit ng API_BASE_URL
        const response = await fetch(`${API_BASE_URL}/clients/all`);
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
        await Alert.alert('Missing Details', 'Please select a driver, date, and time before confirming.', 'warning');
        return;
    }

    btn.disabled   = true;
    const originalText = btn.innerHTML;
    btn.innerHTML  = '<span class="spinner-border spinner-border-sm me-2"></span>Confirming...';

    try {
        const combinedDateTime = `${date} ${time}:00`;

        // ✅ FIXED: Gumamit ng API_BASE_URL
        const response = await fetch(`${API_BASE_URL}/appointments/add`, {
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
                        const formattedDate = new Date(`${date} ${time}`).toLocaleDateString('en-PH', {
                            month: 'long', day: 'numeric', year: 'numeric'
                        });
                        const formattedTime = new Date(`${date} ${time}`).toLocaleTimeString('en-PH', {
                            hour: '2-digit', minute: '2-digit'
                        });

                        const msg = `APPOINTMENTS NOTICE: Hi ${clientData.fullname}, your appointment for ${purpose} is confirmed on ${formattedDate} at ${formattedTime}. Please bring required documents. Thank you!`;

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

            Alert.toast('Appointment scheduled successfully', 'success');
            setTimeout(() => location.reload(), 1400);

        } else {
            await Alert.alert('Scheduling Failed', result.message || 'The server could not process this request.', 'error');
            btn.disabled  = false;
            btn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Critical Error:', error);
        await Alert.alert('Connection Error', 'Could not reach the server. Please check your connection and try again.', 'error');
        btn.disabled  = false;
        btn.innerHTML = originalText;
    }
}

// --- 5. DELETE/CANCEL APPOINTMENT ---
async function deleteAppointment(id) {
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
        // ✅ FIXED: Gumamit ng API_BASE_URL
        const response = await fetch(`${API_BASE_URL}/appointments/${id}`, { method: 'DELETE' });
        if (response.ok) {
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