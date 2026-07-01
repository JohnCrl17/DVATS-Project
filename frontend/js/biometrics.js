

// --- GLOBAL STATE ---
let tempClientData = {};
let faceData = null;
let stream = null;

// --- OCR LOGIC (Tesseract.js) ---
// ─────────────────────────────────────────────────────────────
// OCR FUNCTION — WITH LOADING EFFECT
// ─────────────────────────────────────────────────────────────

async function performOCR(input) {

    const status = document.getElementById('ocr-status');

    if (!input.files || !input.files[0]) return;

    status.innerHTML = `
        <span style="
            color:#fbbf24;
            font-weight:700;
        ">
            🔍 Preparing OCR Scanner...
        </span>
    `;

    try {

        const imageFile = input.files[0];

        // ─────────────────────────────────────────
        // TESSERACT OCR
        // ─────────────────────────────────────────

        const result = await Tesseract.recognize(
            imageFile,
            'eng',
            {

                logger: m => {

                    console.log(m);

                    // INITIALIZING
                    if (m.status === 'initializing tesseract') {

                        status.innerHTML = `
                            <span style="
                                color:#38bdf8;
                                font-weight:700;
                            ">
                                ⚙️ Initializing OCR Engine...
                            </span>
                        `;
                    }

                    // LOADING LANGUAGE
                    else if (m.status === 'loading language traineddata') {

                        status.innerHTML = `
                            <span style="
                                color:#facc15;
                                font-weight:700;
                            ">
                                📚 Loading OCR Data...
                            </span>
                        `;
                    }

                    // PROCESSING %
                    else if (m.status === 'recognizing text') {

                        const progress = Math.round(m.progress * 100);

                        status.innerHTML = `
                            <div style="
                                width:100%;
                                background:#1e293b;
                                border-radius:12px;
                                overflow:hidden;
                                margin-top:8px;
                            ">

                                <div style="
                                    width:${progress}%;
                                    background:linear-gradient(90deg,#3b82f6,#06b6d4);
                                    color:white;
                                    padding:8px;
                                    font-size:12px;
                                    font-weight:bold;
                                    text-align:center;
                                    transition:0.3s;
                                ">
                                    🔍 Scanning License... ${progress}%
                                </div>

                            </div>
                        `;
                    }
                }
            }
        );

        // ─────────────────────────────────────────
        // OCR RAW TEXT
        // ─────────────────────────────────────────

        let rawText = result.data.text.toUpperCase();

        console.log("RAW OCR TEXT:");
        console.log(rawText);

        let lines = rawText
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0);

        // ─────────────────────────────────────────
        // 1. FULL NAME
        // ─────────────────────────────────────────

        for (let i = 0; i < lines.length; i++) {

            if (lines[i].includes("MIDDLE NAME")) {

                document.getElementById('fullname').value =
                    lines[i + 1] || "";

                break;
            }
        }

        // ─────────────────────────────────────────
        // 2. LICENSE NUMBER
        // ─────────────────────────────────────────

        const licenseMatch =
            rawText.match(/[A-Z]\d{2}-\d{2}-[A-Z0-9]{5,7}/);

        if (licenseMatch) {

            document.getElementById('license_no').value =
                licenseMatch[0];
        }

        // ─────────────────────────────────────────
        // 3. DATES
        // ─────────────────────────────────────────

        const dateMatches =
            rawText.match(/\b\d{4}\/\d{2}\/\d{2}\b/g);

        if (dateMatches && dateMatches.length >= 2) {

            const date1 =
                dateMatches[0].replace(/\//g, '-');

            const date2 =
                dateMatches[1].replace(/\//g, '-');

            // DOB first
            if (
                rawText.indexOf("DATE OF BIRTH") <
                rawText.indexOf("EXPIRATION")
            ) {

                document.getElementById('dob').value =
                    date1;

                document.getElementById('license_expiry').value =
                    date2;

                document.getElementById('age').value =
                    calculateAge(date1);

            } else {

                document.getElementById('dob').value =
                    date2;

                document.getElementById('license_expiry').value =
                    date1;

                document.getElementById('age').value =
                    calculateAge(date2);
            }
        }

        // ─────────────────────────────────────────
        // 4. GENDER
        // ─────────────────────────────────────────

        for (let i = 0; i < lines.length; i++) {

            if (lines[i].includes("SEX")) {

                let genderLine = lines[i + 1] || "";

                if (
                    genderLine.includes("M") ||
                    lines[i].includes(" M ")
                ) {

                    document.getElementById('gender').value =
                        "Male";

                } else if (
                    genderLine.includes("F") ||
                    lines[i].includes(" F ")
                ) {

                    document.getElementById('gender').value =
                        "Female";
                }

                break;
            }
        }

        // ─────────────────────────────────────────
        // SUCCESS
        // ─────────────────────────────────────────

        status.innerHTML = `
            <span style="
                color:#10b981;
                font-weight:700;
                font-size:14px;
            ">
                ✅ Scan Complete!
            </span>
        `;

    } catch (err) {

        console.error(err);

        status.innerHTML = `
            <span style="
                color:#ef4444;
                font-weight:700;
            ">
                ❌ Scan Failed.
            </span>
        `;
    }
}

// ─────────────────────────────────────────────────────────────
// PASSWORD TOGGLE
// ─────────────────────────────────────────────────────────────

function togglePassword() {

    const passwordField =
        document.getElementById("password");

    if (passwordField.type === "password") {

        passwordField.type = "text";

    } else {

        passwordField.type = "password";
    }
}

// ─────────────────────────────────────────────────────────────
// AGE CALCULATOR
// ─────────────────────────────────────────────────────────────

function calculateAge(birthDate) {

    const today = new Date();

    const birth = new Date(birthDate);

    let age =
        today.getFullYear() -
        birth.getFullYear();

    const month =
        today.getMonth() -
        birth.getMonth();

    if (
        month < 0 ||
        (
            month === 0 &&
            today.getDate() < birth.getDate()
        )
    ) {
        age--;
    }

    return age;
}

// ─────────────────────────────────────────────────────────────
// AUTO AGE UPDATE
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {

    const dobInput =
        document.getElementById('dob');

    const ageInput =
        document.getElementById('age');

    if (dobInput) {

        dobInput.addEventListener('change', function () {

            const dob = this.value;

            ageInput.value =
                calculateAge(dob);
        });
    }
});

// --- STEP 1: CAPTURE INFO ---
function proceedToBiometrics() {
    const form = document.getElementById('registrationForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    tempClientData = {
        fullname: document.getElementById('fullname').value,
        date_of_birth: document.getElementById('dob').value,
        gender: document.getElementById('gender').value,
        license_no: document.getElementById('license_no').value,
        password: document.getElementById('password').value,
        email: document.getElementById('email').value,
        phone_number: document.getElementById('phone_number').value,
        license_expiry: document.getElementById('license_expiry').value
    };

    // UI Transition
    document.getElementById('step-info').classList.add('step-hidden');
    document.getElementById('step-biometrics').classList.remove('step-hidden');
    
    startCamera();
}

// --- STEP 2: CAMERA & BIOMETRICS ---
function startCamera() {
    const video = document.getElementById('webcam');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(s => {
                stream = s;
                video.srcObject = stream;
                video.play();
            })
            .catch(err => IosAlert.alert("Camera access denied."));
    }
}

function captureFace() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('snapshot');
    const faceStatus = document.getElementById('face-status');
    const btnCapture = document.getElementById('btn-capture');
    const btnRetake = document.getElementById('btn-retake');

    if (video && canvas) {
        // I-draw ang frame sa canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        // I-freeze: itago ang video, ipakita ang canvas
        video.style.display = 'none';
        canvas.style.display = 'block';

        faceData = canvas.toDataURL('image/jpeg');
        if (faceStatus) faceStatus.style.display = 'block';

        // Update buttons
        btnCapture.style.display = 'none';
        btnRetake.style.display = 'block';

        validateAllData();
    }
}

function retakeFace() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('snapshot');
    const faceStatus = document.getElementById('face-status');
    const btnCapture = document.getElementById('btn-capture');
    const btnRetake = document.getElementById('btn-retake');
    const btnSubmit = document.getElementById('btn-submit-all');

    // I-unfreeze: itago ang canvas, ipakita ulit ang video
    canvas.style.display = 'none';
    video.style.display = 'block';

    faceData = null;
    if (faceStatus) faceStatus.style.display = 'none';

    // Reset buttons
    btnCapture.style.display = 'block';
    btnRetake.style.display = 'none';

    // I-disable ulit ang submit
    btnSubmit.disabled = true;
}


function validateAllData() {
    const btnSubmit = document.getElementById('btn-submit-all');
    if (faceData) {
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('opacity-50');
    }
}

// --- STEP 3: FINAL SUBMISSION ---
async function submitRegistration() {
    const btnSubmit = document.getElementById('btn-submit-all');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Generating QR & Saving...`;

    // 1. GENERATE QR CODE MUNA (Sa loob ng invisible or existing container)
    const qrContainer = document.getElementById('qr-display');
    qrContainer.innerHTML = ""; // Linisin muna
    
    // Gamitin ang license_no para sa QR content
    new QRCode(qrContainer, {
        text: tempClientData.license_no,
        width: 256,
        height: 256,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    // 2. HINTAYIN NG KONTI (Dahil kailangan ng QRCode.js ng oras para i-draw ang canvas)
    setTimeout(async () => {
        const qrCanvas = qrContainer.querySelector('canvas');
        let qrBase64 = null;
        
        if (qrCanvas) {
            qrBase64 = qrCanvas.toDataURL('image/png');
        } else {
            // Kung ayaw lumabas ng canvas, baka image tag ang gamit ng library
            const qrImg = qrContainer.querySelector('img');
            if (qrImg) qrBase64 = qrImg.src;
        }

        // --- 3. SETUP FORM DATA NA MAY QR IMAGE ---
        const formData = new FormData();
        for (let key in tempClientData) {
            formData.append(key, tempClientData[key]);
        }
        formData.append('face_data', faceData); 
        formData.append('qr_image', qrBase64); // NGAYON, MAY LAMAN NA ITO!

        try {
            const API_URL = "https://unadroitly-nonthinking-lora.ngrok-free.dev/dvats_api/insert_enforcer.php";
            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData,
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });

            const result = await response.json();

            if (result.status === "success") {
                if (stream) stream.getTracks().forEach(track => track.stop());
                
                // 4. LIPAT NA SA SUCCESS STEP
                document.getElementById('step-biometrics').classList.add('step-hidden');
                document.getElementById('step-success').classList.remove('step-hidden');
                console.log("Registered with QR Image!");
            } else {
                IosAlert.alert("Registration Failed: " + result.message);
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = "SAVE & GENERATE QR CODE";
            }
        } catch (err) {
            console.error("Submission Error:", err);
            IosAlert.alert("System Error: Check Ngrok connection.");
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = "SAVE & GENERATE QR CODE";
        }
    }, 800); // 800ms delay para siguradong tapos na ang QR rendering
}

function downloadQR() {
    const canvas = document.querySelector('#qr-display canvas');
    const link = document.createElement('a');
    link.download = `LTO-QR-${tempClientData.license_no}.png`;
    link.href = canvas.toDataURL();
    link.click();
}