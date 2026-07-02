const express = require("express");
const path = require("path");
const cors = require("cors");
const session = require('express-session');
const mysql = require('mysql2');
const axios = require('axios'); // Added for SMS API calls
const QRCode = require('qrcode');

// Middleware & Auth
// --- Middleware & Auth ---
const protect = require('./middleware/authMiddleware');
const authRoutes = require("./routes/auth");
const enforcerRoutes = require('./routes/web-enforcers');
const dashboardRoutes = require('./routes/web-dashboard');
const clientRoutes = require('./routes/web-clients');
const violationRoutes = require('./routes/web-violations');
const ordinanceRoutes = require('./routes/web-ordinance'); // Siguraduhin na ang file ay web-ordinances.js
const registerRoutes = require('./routes/web-register');

const app = express();

// 1. Database Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) {
        console.error("❌ DB CONNECTION FAILED:", err);
    } else {
        console.log("✅ Connected to Laragon MySQL Database");
    }
});

// 2. Parsers & Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// 3. Session Logic
app.use(session({
    secret: 'lto-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true }
}));

// 4. Auth Routes
app.use("/api/auth", authRoutes);
app.use('/api/web-enforcers', enforcerRoutes);
app.use('/api/web-dashboard', dashboardRoutes);
app.use('/api/web-clients', clientRoutes);
app.use('/api/web-violations', violationRoutes);
app.use('/api/web-ordinance', ordinanceRoutes);
app.use('/api/web-register', registerRoutes);


// --- 📱 SMS HELPER FUNCTION ---
// This function handles the logic for sending alerts to clients
// --- 📱 UNIVERSAL SMS HELPER FUNCTION ---
async function sendSMS(phoneNumber, message) {
    const SEMAPHORE_API_KEY = '41841a5c26dbea52356f817247fd3c8b'; 

    try {
        const response = await axios.post('https://api.semaphore.co/api/v4/messages', {
            apikey: SEMAPHORE_API_KEY,
            number: phoneNumber,
            message: message
        });
        console.log("✅ SMS Sent:", response.data);
        return { success: true };
    } catch (error) {
        console.error("❌ SMS Error:", error.response ? error.response.data : error.message);
        return { success: false };
    }
}

// --- 👤 CLIENT ENDPOINTS ---
app.get("/api/clients/all", (req, res) => {
    const sql = "SELECT client_id, fullname, license_no, phone_number, reg_date FROM clients ORDER BY reg_date DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/clients/:id', (req, res) => {
    // Using * ensures age, gender, and email are included in the 'client' object
    const sql = "SELECT * FROM clients WHERE client_id = ?"; 
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result[0]);
    });
});

// Nav Guard for Settings
app.get('/settings.html', protect, (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.redirect('/dashboard.html'); // Send staff back to dashboard
    }
    res.sendFile(path.join(__dirname, "../frontend/settings.html"));
});

app.post('/api/clients/update-biometrics', (req, res) => {
    const { client_id, face_template, fingerprint_id } = req.body;
    const sql = "UPDATE clients SET face_template = ?, fingerprint_id = ? WHERE client_id = ?";
    
    db.query(sql, [face_template, fingerprint_id, client_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- ⚖️ VIOLATION ENDPOINTS (WITH SMS TRIGGER) ---
app.post('/api/violations/add', (req, res) => {
    const { client_id, violation_type, penalty_amount } = req.body;
    const sql = "INSERT INTO violations (client_id, violation_type, penalty_amount, status) VALUES (?, ?, ?, 'Unpaid')";
    
    db.query(sql, [client_id, violation_type, penalty_amount], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        // --- SMS TRIGGER LOGIC ---
        // Fetch client details to get phone number for the alert
        db.query("SELECT phone_number, fullname FROM clients WHERE client_id = ?", [client_id], (err, rows) => {
            if (!err && rows.length > 0) {
                sendViolationSMS(rows[0].phone_number, rows[0].fullname, violation_type, penalty_amount);
            }
        });

        res.json({ success: true, message: "Violation recorded & SMS notification sent!" });
    });
});

// --- 🤳 MOBILE APP LOGIN (Face recognition support) ---
app.post('/api/mobile/login', (req, res) => {
    const { face_data_login } = req.body;
    // Querying clients who have biometric templates saved
    const sql = "SELECT client_id, fullname, license_no FROM clients WHERE face_template IS NOT NULL";
    
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, error: "Database error" });
        
        // In your production app, you will use a library like face-api.js 
        // to compare face_data_login with the stored templates in 'results'
        res.json({ 
            success: true, 
            message: "Comparison data ready", 
            templates: results 
        });
    });
});

// --- (Existing Endpoints: Violations All, Client ID History, Appointments, Stats, etc.) ---
app.get('/api/violations/all', (req, res) => {
    const sql = `SELECT v.*, c.fullname FROM violations v JOIN clients c ON v.client_id = c.client_id ORDER BY v.violation_date DESC`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/violations/all', (req, res) => {
    // SIGURADUHIN: Ang prefixes ay lto_system. at dvats_db.
    const sql = `
        SELECT 
            v.*, 
            c.fullname AS violator_name,
            c.license_no AS violator_license,
            e.full_name AS enforcer_name
        FROM lto_system.violations v
        LEFT JOIN lto_system.clients c ON v.client_id = c.client_id
        LEFT JOIN dvats_db.enforcers e ON v.enforcer_badge = e.badge_number
        ORDER BY v.violation_date DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            // I-return ang error as JSON para hindi mag-crash ang frontend
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.get('/api/appointments/all', (req, res) => {
    const sql = `SELECT a.*, c.fullname, c.license_no FROM appointments a JOIN clients c ON a.client_id = c.client_id ORDER BY a.appointment_date ASC`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/appointments/add', (req, res) => {
    const { client_id, appointment_date, purpose, status } = req.body;
    const sql = "INSERT INTO appointments (client_id, appointment_date, purpose, status) VALUES (?, ?, ?, ?)";
    db.query(sql, [client_id, appointment_date, purpose, status], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database Error" });
        res.json({ success: true, message: "Appointment scheduled!" });
    });
});

app.delete('/api/appointments/:id', (req, res) => {
    const sql = "DELETE FROM appointments WHERE appointment_id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.get('/api/stats/summary', (req, res) => {
        const sql = `
            SELECT 
                (SELECT COUNT(*) FROM clients) as totalClients,
                (SELECT COUNT(*) FROM violations) as totalViolations,
                (SELECT COUNT(*) FROM appointments) as totalAppointments,
                (SELECT COALESCE(SUM(penalty_amount), 0) FROM violations) as totalRevenue
        `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(results[0]);
    });
});

// --- NAVIGATION ---
app.get('/dashboard.html', protect, (req, res) => res.sendFile(path.join(__dirname, "../frontend/dashboard.html")));
app.get('/clients.html', protect, (req, res) => res.sendFile(path.join(__dirname, "../frontend/clients.html")));
app.get('/appointments.html', protect, (req, res) => res.sendFile(path.join(__dirname, "../frontend/appointments.html")));
app.get('/violations.html', protect, (req, res) => res.sendFile(path.join(__dirname, "../frontend/violations.html")));

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

app.put('/api/violations/pay/:id', (req, res) => {
    const violationId = req.params.id;
    const sql = "UPDATE violations SET status = 'Paid' WHERE violation_id = ?";
    db.query(sql, [violationId], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database Error" });
        res.json({ success: true, message: "Fine marked as paid!" });
    });
});

// --- 1. FIXED RECENT ACTIVITY LOG ---
// --- FIXED RECENT ACTIVITY LOG ---
app.get('/api/stats/recent-activity', (req, res) => {
    const sql = `
        (SELECT 
            'CLIENT' as type, 
            CONCAT('Registered: ', fullname) as description, 
            reg_date as activity_date, 
            'REGISTERED' as status 
         FROM clients)
        UNION ALL
        (SELECT 
            'VIOLATION' as type, 
            CONCAT(fullname, ' - ', violation_type) as description, 
            violation_date as activity_date, 
            v.status 
         FROM violations v JOIN clients c ON v.client_id = c.client_id)
        UNION ALL
        (SELECT 
            'APPOINTMENT' as type, 
            CONCAT(fullname, ' - ', purpose) as description, 
            appointment_date as activity_date, 
            a.status 
         FROM appointments a JOIN clients c ON a.client_id = c.client_id)
        ORDER BY activity_date DESC LIMIT 15
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Activity Log Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// --- 2. ADDED LOGOUT ROUTE (Fixes the "Cannot GET /api/auth/logout" error) ---
app.get('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Could not log out" });
        }
        res.redirect('/login.html'); // Redirect user back to login page
    });
});

// --- 3. CLEANED UP CLIENT REGISTRATION ---
app.post('/api/clients/register', async (req, res) => {
    try {
        const { fullname, age, gender, license_no, password, email, phone_number, face_data, finger_data } = req.body;

        // 1. Generate QR Token at Image gamit ang QRCode library
        const qrToken = `LTO-DVATS-${license_no}-${Date.now()}`;
        const qrImage = await QRCode.toDataURL(qrToken);

        // 2. SQL Insert (Sinunod natin ang columns mo sa HeidiSQL)
        // Siguraduhin na may columns na password, qr_token, at qr_image sa table mo
        const sql = `INSERT INTO clients 
            (fullname, age, gender, license_no, password, email, phone_number, face_data, finger_data, qr_token, qr_image) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const values = [fullname, age, gender, license_no, password, email, phone_number, face_data, finger_data, qrToken, qrImage];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error("❌ Registration Error:", err);
                return res.status(500).json({ success: false, message: "DB Error: " + err.message });
            }
            
            // 3. I-send ang QR pabalik sa frontend para lumabas yung download button
            res.status(200).json({ 
                success: true, 
                message: "Client registered successfully!",
                qrCodeData: qrImage 
            });
        });
    } catch (err) {
        console.error("❌ Server Error:", err);
        res.status(500).json({ success: false, message: "Failed to generate QR Code" });
    }
});

// Add this to your server.js
app.get('/api/clients/license/:licenseNo', (req, res) => {
    const sql = "SELECT * FROM clients WHERE license_no = ?";
    db.query(sql, [req.params.licenseNo], (err, result) => {
        if (err) return res.status(500).send(err);
        if (result.length === 0) return res.status(404).json({ message: "Not Found" });
        res.json(result[0]);
    });
});

// Example of what your server-side code should look like:
// --- SECURE DELETE ENDPOINT ---
// --- SECURE DELETE ENDPOINT (UPDATED) ---
// --- 🛡️ SECURE & SMART DELETE ENDPOINT ---
// Pinagsama ang Admin Security at Unpaid Violation Validation
app.delete('/api/clients/:id', (req, res) => {
    const clientId = req.params.id;

    // 1. SECURITY CHECK: Gatekeeper (Dapat Admin lang)
    if (!req.session.user || String(req.session.user.role).toLowerCase() !== 'admin') {
        console.log(`🚫 Unauthorized delete attempt on Client ID: ${clientId}`);
        return res.status(403).json({ 
            success: false, 
            message: "Permission Denied: Only Admins can delete client records." 
        });
    }

    // 2. VALIDATION: Check kung may "Unpaid" na Violations
    const checkUnpaidSql = "SELECT COUNT(*) AS unpaidCount FROM violations WHERE client_id = ? AND status = 'Unpaid'";

    db.query(checkUnpaidSql, [clientId], (err, results) => {
        if (err) {
            console.error("❌ Validation Error:", err);
            return res.status(500).json({ success: false, message: "Server Error during validation." });
        }

        const unpaidCount = results[0].unpaidCount;

        if (unpaidCount > 0) {
            // Haharangin ang pag-delete dahil may utang pa
            return res.status(400).json({ 
                success: false, 
                message: `Cannot delete! This driver has ${unpaidCount} UNPAID violation(s). Please settle the fines first.` 
            });
        }

        // 3. CASCADE DELETE: Kapag 'Paid' na lahat o walang violation, proceed sa pag-delete
        console.log(`🧹 Cleaning up records for Client ID: ${clientId}...`);

        const deleteViolations = "DELETE FROM violations WHERE client_id = ?";
        const deleteAppointments = "DELETE FROM appointments WHERE client_id = ?";
        const deleteClient = "DELETE FROM clients WHERE client_id = ?";

        // Sunod-sunod na pag-delete para iwas sa Foreign Key Constraint errors
        db.query(deleteViolations, [clientId], (err1) => {
            if (err1) console.error("Note: No violations or error clearing them.");

            db.query(deleteAppointments, [clientId], (err2) => {
                if (err2) console.error("Note: No appointments or error clearing them.");

                db.query(deleteClient, [clientId], (err3, result) => {
                    if (err3) {
                        console.error("❌ Final Deletion Error:", err3);
                        return res.status(500).json({ success: false, message: "Database Error: " + err3.message });
                    }

                    if (result.affectedRows === 0) {
                        return res.status(404).json({ success: false, message: "Client not found." });
                    }

                    console.log(`✅ SUCCESS: Client ${clientId} deleted by Admin ${req.session.user.email}`);
                    res.json({ 
                        success: true, 
                        message: "Client and all cleared records have been deleted successfully." 
                    });
                });
            });
        });
    });
});

// --- CREATE NEW STAFF ACCOUNT ---
app.post('/api/auth/register-staff', (req, res) => {
    const { email, password } = req.body;
    const role = 'staff'; // Force role to staff for this route

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const sql = "INSERT INTO admins (username, password, role) VALUES (?, ?, ?)";
    db.query(sql, [email, password, role], (err, result) => {
        if (err) {
            console.error("❌ Error creating staff:", err);
            return res.status(500).json({ success: false, message: "Account already exists or database error" });
        }
        res.json({ success: true, message: "Staff account created successfully!" });
    });
});

// --- USER MANAGEMENT API ---

// 1. Fetch all users for the "Existing Accounts" table
app.get('/api/auth/users', (req, res) => {
    const sql = "SELECT id, username, role FROM admins";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 2. Create a new Staff account
app.post('/api/auth/register-staff', (req, res) => {
    const { email, password } = req.body;
    const sql = "INSERT INTO admins (username, password, role) VALUES (?, ?, 'staff')";
    
    db.query(sql, [email, password], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json({ success: true, message: "Staff account created!" });
    });
});

// Idagdag ito sa itaas ng server.js
function sendViolationSMS(phone, name, type, penalty) {
    console.log(`[SMS Simulation] Sending to ${phone}: Hi ${name}, you have a violation: ${type} with penalty P${penalty}.`);
    // Dito mo ilalagay yung logic ng SMS API mo sa susunod
}

app.get('/api/driver/my-violations', (req, res) => {
    // I-check kung may driver na naka-session
    if (!req.session.user || req.session.user.role !== 'driver') {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const driverId = req.session.user.id;
    const sql = "SELECT * FROM violations WHERE client_id = ? ORDER BY violation_date DESC";

    db.query(sql, [driverId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json({ success: true, violations: results });
    });
});

// --- DRIVER LOGIN ROUTE ---
app.post('/api/driver/login', (req, res) => {
    const { license, password } = req.body;

    // Kunin ang data base sa license_no
    const sql = "SELECT * FROM clients WHERE license_no = ?";
    
    db.query(sql, [license], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });

        if (results.length > 0) {
            const driver = results[0];

            // Password Check
            if (String(password) === String(driver.password)) {
                
                // Dahil 'fullname' ang column sa database mo, ito ang gagamitin natin
                const driverName = driver.fullname || "Driver";

                req.session.user = {
                    id: driver.client_id,
                    license: driver.license_no,
                    name: driverName,
                    role: 'driver' 
                };

                return res.json({ 
                    success: true, 
                    driver: {
                        name: driverName,
                        license: driver.license_no,
                        qr: driver.qr_image || "" // Eto yung LONGTEXT sa database mo
                    }
                });
            } else {
                return res.status(401).json({ success: false, message: "Maling password!" });
            }
        } else {
            return res.status(404).json({ success: false, message: "License not found!" });
        }
    });
});

app.get('/api/driver/dashboard-data', (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });

    const clientId = req.session.user.id;

    // Hiwalay na queries para iwas sa SQL syntax error
    const sqlStats = `
        SELECT 
            (SELECT SUM(penalty_amount) FROM violations WHERE client_id = ? AND status = 'Paid') as totalPaid,
            (SELECT SUM(penalty_amount) FROM violations WHERE client_id = ? AND status = 'Unpaid') as unpaidFines,
            (SELECT license_no FROM clients WHERE client_id = ?) as license`;
    
    const sqlViolations = `SELECT * FROM violations WHERE client_id = ? ORDER BY violation_date DESC`;
    const sqlAppointments = `SELECT * FROM appointments WHERE client_id = ? ORDER BY appointment_date ASC`;

    // Sabay-sabay nating i-execute ang tatlong query
    db.query(sqlStats, [clientId, clientId, clientId], (err, statsResult) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        db.query(sqlViolations, [clientId], (err, violationsResult) => {
            if (err) return res.status(500).json({ success: false, error: err.message });

            db.query(sqlAppointments, [clientId], (err, appointmentsResult) => {
                if (err) return res.status(500).json({ success: false, error: err.message });

                // Dito natin pagsasama-samahin ang response
                res.json({
                    success: true,
                    totalPaid: statsResult[0].totalPaid || 0,
                    unpaidFines: statsResult[0].unpaidFines || 0,
                    violations: violationsResult,
                    appointments: appointmentsResult
                });
            });
        });
    });
});

// Halimbawa ng registration route sa Node.js
// =============================================================================
// 🛡️ DASMA TMO ENFORCER WHITELIST & OTP REGISTRATION NODE
// =============================================================================

// Gagawa tayo ng hiwalay na connection string para kay dvats_db dahil magkaiba sila ni lto_system
// ✅ DITO YUNG FIX: Dynamic connection based on environment
const dvats_db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME_MOBILE || 'dvats_db',
    port: process.env.DB_PORT || 3306
});

dvats_db.connect((err) => {
    if (!err) console.log("✅ Mobile Node (dvats_db) Connected");
});

// ─── STAGE 1: VERIFY BADGE NUMBER & GENERATE SECURE OTP ──────────────────────
app.post('/api/enforcer/verify-badge', (req, res) => {
    const { badge_number } = req.body;

    if (!badge_number) return res.status(400).json({ message: "Badge number is required pre." });

    // 1. I-check kung rehistrado ang badge sa whitelist
    const checkSql = "SELECT status FROM enforcers WHERE badge_number = ?";
    dvats_db.query(checkSql, [badge_number], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (rows.length === 0) {
            return res.status(404).json({ message: "Access Denied: Hindi rehistrado ang Badge Number na ito sa Dasma TMO Admin." });
        }

        const enforcer = rows[0];

        // 2. Gatekeeper: I-validate kung LOCKED o ACTIVE na ang account
        if (enforcer.status === 'LOCKED') {
            return res.status(403).json({ message: "TERMINAL LOCKED: Ang profile na ito ay naka-lock dahil sa sunod-sunod na maling OTP input. Mag-report sa Dasma Head Office." });
        }
        if (enforcer.status === 'ACTIVE') {
            return res.status(400).json({ message: "Account is already active. Please proceed to the Login interface." });
        }

        // 3. Generate ng Random 6-Digit OTP (Simulated Payload)
        const simulatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

        // 4. I-save ang OTP sa column ng enforcer at i-reset ang attempt counter sa 0
        const updateOtpSql = "UPDATE enforcers SET registration_otp = ?, otp_attempts = 0 WHERE badge_number = ?";
        dvats_db.query(updateOtpSql, [simulatedOTP, badge_number], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });

            // DEV MODE TRICK: Ibinabalik natin ang OTP sa response block 
            // para mabasa mo sa terminal ng React Native habang nagde-demo ka, kahit wala pang SMS/Email setup!
            return res.status(200).json({
                success: true,
                message: "Badge number verified. Security code generated.",
                otp: simulatedOTP 
            });
        });
    });
});

// ─── STAGE 2: VERIFY OTP CODE & RATE-LIMITING 2 ATTEMPTS LOCKDOWN ────────────
app.post('/api/enforcer/verify-otp', (req, res) => {
    const { badge_number, otp } = req.body;

    const sql = "SELECT registration_otp, otp_attempts, status FROM enforcers WHERE badge_number = ?";
    dvats_db.query(sql, [badge_number], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length === 0) return res.status(404).json({ message: "Personnel not found." });

        const enforcer = rows[0];

        if (enforcer.status === 'LOCKED') {
            return res.status(403).json({ message: "This terminal node is heavily locked." });
        }

        // TUGMA: Tama ang itinanipulang OTP
        if (enforcer.registration_otp === otp) {
            // Linisin ang temporary validation variables pero panatilihing PENDING muna
            const clearOtpSql = "UPDATE enforcers SET registration_otp = NULL, otp_attempts = 0 WHERE badge_number = ?";
            dvats_db.query(clearOtpSql, [badge_number], () => {
                return res.status(200).json({ success: true, message: "Security match success. Proceed to configuration." });
            });
        } 
        // SABLAY: Maling OTP ang ibinato ng client app
        else {
            const nextAttempts = enforcer.otp_attempts + 1;

            if (nextAttempts >= 2) {
                // LOCKDOWN INTRUSION DETECTION: I-lock ang account dahil lumagpas sa 2 subok (Ayon sa gusto mo pre)
                const lockSql = "UPDATE enforcers SET status = 'LOCKED', registration_otp = NULL, otp_attempts = ? WHERE badge_number = ?";
                dvats_db.query(lockSql, [nextAttempts, badge_number], () => {
                    return res.status(423).json({ message: "Security Lockdown triggered. Device registration block active." });
                });
            } else {
                // I-update lang ang attempt count para sa susunod na subok
                const incrementAttemptsSql = "UPDATE enforcers SET otp_attempts = ? WHERE badge_number = ?";
                dvats_db.query(incrementAttemptsSql, [nextAttempts, badge_number], () => {
                    return res.status(400).json({ message: "Invalid verification token payload." });
                });
            }
        }
    });
});

// ─── STAGE 3: FINALIZE PASSWORD & ACTIVATE PROFILE ───────────────────────────
app.post('/api/enforcer/activate-account', (req, res) => {
    const { badge_number, password } = req.body;

    // Baguhin ang password at ilipat sa ACTIVE ang status para makapag-login na siya sa Mobile App terminal
    const activateSql = "UPDATE enforcers SET password = ?, status = 'ACTIVE' WHERE badge_number = ?";
    dvats_db.query(activateSql, [password, badge_number], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.affectedRows > 0) {
            return res.status(200).json({ success: true, message: "Account profile successfully synchronized and active." });
        } else {
            return res.status(400).json({ message: "Synchronization payload fault." });
        }
    });
});