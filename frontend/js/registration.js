// --- GLOBAL STATE ---
let tempClientData = {};
let faceData = null;  // Dito mase-save ang Base64 ng mukha
let fingerData = null; // Dito mase-save ang Base64 ng fingerprint

/**
 * STEP 1: Capture Info & Navigate
 */
function proceedToBiometrics() {
    const form = document.getElementById('registrationForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // Capture ALL Data from Step 1
    tempClientData = {
        fullname: document.getElementById('fullname').value,
        license_no: document.getElementById('license_no').value,
        password: document.getElementById('password').value, 
        age: document.getElementById('age').value,           
        gender: document.getElementById('gender').value,     
        email: document.getElementById('email').value,
        phone_number: document.getElementById('phone_number').value
    };

    console.log("Step 1 Data Captured:", tempClientData);

    // UI Transition
    document.getElementById('step-info').classList.add('step-hidden');
    document.getElementById('step-biometrics').classList.remove('step-hidden');
    
    // Start Camera
    if (typeof startCamera === "function") {
        startCamera();
    } else {
        console.error("Camera function not found in biometrics.js");
    }
}

/**
 * FINAL STEP: Ito ang tatawagin ng button sa dulo
 */
async function submitRegistration() {
    // 1. Check muna kung may biometric data na (Galing ito sa biometrics.js)
    // Siguraduhin na sa biometrics.js, sine-set mo ang global faceData at fingerData
    if (!faceData || !fingerData) {
        alert("Please capture both Face and Fingerprint before saving.");
        return;
    }

    const btnSubmit = document.getElementById('btn-submit-all');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Syncing to DVATS...`;

    // 2. Pagsamahin ang lahat ng data
    const finalPayload = {
        ...tempClientData,
        face_data: faceData,
        finger_data: fingerData
    };

    try {
        const response = await fetch('/api/clients/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPayload)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // STOP CAMERA TRACKS
            const video = document.getElementById('webcam');
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
            }

            // SHOW SUCCESS AND QR CODE
            showRegistrationSuccess(result.qrCodeData); 
        } else {
            alert("Error: " + (result.message || "Registration failed."));
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `SAVE & GENERATE QR CODE`;
        }
    } catch (err) {
        console.error("Upload failed", err);
        alert("Server connection failed. Please check your backend.");
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `SAVE & GENERATE QR CODE`;
    }
}

/**
 * UI HELPER: Ipakita ang QR Code pagkatapos mag-register
 */
function showRegistrationSuccess(qrData) {
    // Linisin ang step-biometrics container para ipakita ang success
    const container = document.getElementById('step-biometrics');
    
    container.innerHTML = `
        <div class="text-center p-4 animate__animated animate__fadeIn">
            <div class="mb-4">
                <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem;"></i>
            </div>
            <h2 class="font-black text-slate-800">Registration Complete!</h2>
            <p class="text-slate-500 mb-6">Your digital identity is now active.</p>
            
            <div class="bg-white p-4 d-inline-block rounded-4 shadow-sm border mb-6">
                <img src="${qrData}" alt="Driver QR Code" class="img-fluid" style="max-width: 200px; border: 2px solid #eee;">
            </div>
            
            <div class="alert alert-light border text-start mb-6" style="max-width: 300px; margin: 0 auto;">
                <small class="d-block text-uppercase font-black text-slate-400" style="font-size: 10px;">License Number</small>
                <span class="font-bold text-slate-700">${tempClientData.license_no}</span>
            </div>

            <div class="d-grid gap-2 mt-4" style="max-width: 400px; margin: 20px auto 0;">
                <a href="${qrData}" download="LTO-QR-${tempClientData.license_no}.png" class="btn btn-primary py-3 rounded-4 font-bold">
                    <i class="bi bi-download me-2"></i> DOWNLOAD QR CODE
                </a>
                <button onclick="window.location.href='dashboard.html'" class="btn btn-link text-slate-400 font-bold text-decoration-none">
                    GO TO DASHBOARD
                </button>
            </div>
        </div>
    `;
}