/**
 * LTO SYSTEM - UNIVERSAL SIDEBAR TOGGLE
 * Optimized to prevent clashing between Clients, Violations, and Appointments.
 */

const setupSidebar = () => {
    const sidebar = document.getElementById("sidebar");
    const main = document.getElementById("mainContent");
    const btn = document.getElementById("sidebarToggle");

    if (btn && sidebar && main) {
        // We use 'onclick' to ensure there is ONLY ONE listener active
        btn.onclick = function (e) {
            e.preventDefault();
            
            sidebar.classList.toggle("collapsed");
            main.classList.toggle("expanded");
            
            console.log("Sidebar Toggled Success!");
        };
    } else {
        // If elements aren't found, wait 500ms and try one more time
        setTimeout(setupSidebar, 500);
    }
};

// Start trying to attach the toggle logic immediately
setupSidebar();

// Backup: Run again when the window is fully loaded
window.onload = setupSidebar;

/**
 * Logout Logic
 */
function logout() {
    window.location.href = "index.html";
}