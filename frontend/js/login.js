

// Function to handle login
async function login() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginCard = document.querySelector('.login-card');
    const btn = document.querySelector('.btn-primary');

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // Reset styles
    emailInput.classList.remove('is-invalid');
    passwordInput.classList.remove('is-invalid');

    // 1. Shake for empty fields
    if (!email || !password) {
        loginCard.classList.add('shake-animation');
        setTimeout(() => loginCard.classList.remove('shake-animation'), 500);
        if (!email) emailInput.classList.add('is-invalid');
        if (!password) passwordInput.classList.add('is-invalid');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = 'Logging in...';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            // 1. Save the role so the dashboard knows what to show/hide
            localStorage.setItem('userRole', data.role);
            
            // 2. Optional: Save the email to show "Welcome, [email]" on the dash
            localStorage.setItem('userEmail', email);

            // Success! Hard redirect to dashboard
            window.location.replace('/dashboard.html');
        } else {
            loginCard.classList.add('shake-animation');
            setTimeout(() => loginCard.classList.remove('shake-animation'), 500);
            IosAlert.alert(data.message || "Invalid credentials");
            btn.disabled = false;
            btn.innerHTML = 'Login';
        }
    } catch (error) {
        console.error("Login Error:", error);
        btn.disabled = false;
        btn.innerHTML = 'Login';
    }
}

// 2. Eye Toggle Logic
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('togglePassword');
    const passwordField = document.getElementById('password');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            const type = passwordField.type === 'password' ? 'text' : 'password';
            passwordField.type = type;
            const icon = this.querySelector('i');
            icon.classList.toggle('bi-eye');
            icon.classList.toggle('bi-eye-slash');
        });
    }
});

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        // Change icon to 'eye-slash' when showing password
        eyeIcon.classList.remove('bi-eye');
        eyeIcon.classList.add('bi-eye-slash');
    } else {
        passwordInput.type = 'password';
        // Change icon back to 'eye' when hiding password
        eyeIcon.classList.remove('bi-eye-slash');
        eyeIcon.classList.add('bi-eye');
    }
}