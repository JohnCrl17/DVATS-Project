document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    loadUsers();

    // Event Listener for the Create Button
    const createBtn = document.getElementById('btnCreateStaff');
    if (createBtn) {
        createBtn.addEventListener('click', createStaffAccount);
    }
});

// --- 1. SIDEBAR TOGGLE (FIXED) ---
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

// --- 2. LOAD USERS ---
async function loadUsers() {
    const tableBody = document.getElementById('adminUsersList');
    if (!tableBody) return;

    try {
        const res = await fetch('/api/auth/users');
        const users = await res.json();
        
        if (!users || users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-slate-400">No accounts found.</td></tr>';
            return;
        }

        tableBody.innerHTML = users.map(user => `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-3 font-bold text-slate-700 text-sm">${user.username}</td>
                <td class="px-6 py-3">
                    <span class="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter ${user.role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}">
                        ${user.role}
                    </span>
                </td>
                <td class="px-6 py-3 text-end">
                    ${user.role !== 'admin' ? `
                        <button class="text-red-500 hover:text-red-700 font-bold text-xs uppercase tracking-widest" onclick="deleteUser(${user.id})">
                            Remove
                        </button>` : '<span class="text-[10px] text-slate-300 font-bold uppercase">System Locked</span>'}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-red-500 font-bold">Error loading users.</td></tr>';
    }
}

// --- 3. CREATE STAFF ACCOUNT ---
async function createStaffAccount() {
    const email = document.getElementById('staffEmail').value;
    const password = document.getElementById('staffPass').value;
    const btn = document.getElementById('btnCreateStaff');

    if (!email || !password) return alert("Paki-fill up lahat ng fields.");

    btn.disabled = true;
    btn.innerText = "Creating...";

    try {
        const res = await fetch('/api/auth/register-staff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await res.json();
        if (result.success) {
            alert("✅ Staff account created!");
            document.getElementById('staffEmail').value = '';
            document.getElementById('staffPass').value = '';
            loadUsers(); // Refresh list
        } else {
            alert("❌ Failed: " + result.message);
        }
    } catch (err) {
        console.error("Error:", err);
        alert("System Error. Try again.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Create Account";
    }
}

// --- 4. DELETE USER ---
async function deleteUser(id) {
    if (!confirm("Sigurado ka bang tatanggalin ang account na ito?")) return;

    try {
        const res = await fetch(`/api/auth/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadUsers(); // Refresh the table
        } else {
            alert("Could not delete user.");
        }
    } catch (err) {
        console.error("Delete failed:", err);
    }
}