const express = require("express");
const path = require("path");
const cors = require("cors");
const session = require('express-session');
const mysql = require('mysql2');
const axios = require('axios');
const QRCode = require('qrcode');

const protect = require('./middleware/authMiddleware');
const authRoutes = require("./routes/auth");
const enforcerRoutes = require('./routes/web-enforcers');
const dashboardRoutes = require('./routes/web-dashboard');
const clientRoutes = require('./routes/web-clients');
const violationRoutes = require('./routes/web-violations');
const ordinanceRoutes = require('./routes/web-ordinance');
const registerRoutes = require('./routes/web-register');

const app = express();

// 1. Database Connection (lto_system)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) console.error("❌ DB CONNECTION FAILED:", err);
    else console.log("✅ Connected to MySQL (Cloud)");
});

// ✅ EXPORT for web-violations.js
module.exports.db = db;

// 2. dvats_db Connection (mobile)
const dvats_db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'dvats_db',
    port: process.env.DB_PORT || 3306
});

dvats_db.connect((err) => {
    if (!err) console.log("✅ Mobile Node (dvats_db) Connected to Cloud");
    else console.warn("⚠️ Mobile Node connection failed (non-critical):", err.message);
});

// ✅ EXPORT for web-violations.js
module.exports.dvats_db = dvats_db;

// 3. Parsers & Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// 4. Session
app.use(session({
    secret: 'lto-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true }
}));

// 5. Routes
app.use("/api/auth", authRoutes);
app.use('/api/web-enforcers', enforcerRoutes);
app.use('/api/web-dashboard', dashboardRoutes);
app.use('/api/web-clients', clientRoutes);
app.use('/api/web-violations', violationRoutes(db, dvats_db));
app.use('/api/web-ordinance', ordinanceRoutes);
app.use('/api/web-register', registerRoutes);

// --- SMS HELPER ---
async function sendSMS(phoneNumber, message) {
    const SEMAPHORE_API_KEY = '41841a5c26dbea52356f817247fd3c8b';
    try {
        const response = await axios.post('https://api.semaphore.co/api/v4/messages', {
            apikey: SEMAPHORE_API_KEY, number: phoneNumber, message: message
        });
        console.log("✅ SMS Sent:", response.data);
        return { success: true };
    } catch (error) {
        console.error("❌ SMS Error:", error.response ? error.response.data : error.message);
        return { success: false };
    }
}

function sendViolationSMS(phone, name, type, penalty) {
    console.log(`[SMS] Sending to ${phone}: Hi ${name}, violation: ${type}, penalty: P${penalty}.`);
}

// --- CLIENT ENDPOINTS ---
app.get("/api/clients/all", (req, res) => {
    db.query("SELECT client_id, fullname, license_no, phone_number, reg_date FROM clients ORDER BY reg_date DESC", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/clients/:id', (req, res) => {
    db.query("SELECT * FROM clients WHERE client_id = ?", [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result[0]);
    });
});

app.get('/settings.html', protect, (req, res) => {
    if (req.session.user.role !== 'admin') return res.redirect('/dashboard.html');
    res.sendFile(path.join(__dirname, "../frontend/settings.html"));
});

app.post('/api/clients/update-biometrics', (req, res) => {
    const { client_id, face_template, fingerprint_id } = req.body;
    db.query("UPDATE clients SET face_template = ?, fingerprint_id = ? WHERE client_id = ?", [face_template, fingerprint_id, client_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- VIOLATION ENDPOINTS ---
app.post('/api/violations/add', (req, res) => {
    const { client_id, violation_type, penalty_amount } = req.body;
    db.query("INSERT INTO violations (client_id, violation_type, penalty_amount, status) VALUES (?, ?, ?, 'Unpaid')", [client_id, violation_type, penalty_amount], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        db.query("SELECT phone_number, fullname FROM clients WHERE client_id = ?", [client_id], (err, rows) => {
            if (!err && rows.length > 0) sendViolationSMS(rows[0].phone_number, rows[0].fullname, violation_type, penalty_amount);
        });
        res.json({ success: true, message: "Violation recorded!" });
    });
});

app.post('/api/mobile/login', (req, res) => {
    db.query("SELECT client_id, fullname, license_no FROM clients WHERE face_template IS NOT NULL", (err, results) => {
        if (err) return res.status(500).json({ success: false, error: "Database error" });
        res.json({ success: true, message: "Comparison data ready", templates: results });
    });
});

app.get('/api/violations/all', (req, res) => {
    const sql = `SELECT v.*, c.fullname AS violator_name, c.license_no AS violator_license, e.full_name AS enforcer_name FROM violations v LEFT JOIN clients c ON v.client_id = c.client_id LEFT JOIN dvats_db.enforcers e ON v.enforcer_badge = e.badge_number ORDER BY v.violation_date DESC`;
    db.query(sql, (err, results) => {
        if (err) { console.error("DB Error:", err); return res.status(500).json({ error: err.message }); }
        res.json(results);
    });
});

app.get('/api/appointments/all', (req, res) => {
    db.query("SELECT a.*, c.fullname, c.license_no FROM appointments a JOIN clients c ON a.client_id = c.client_id ORDER BY a.appointment_date ASC", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/appointments/add', (req, res) => {
    const { client_id, appointment_date, purpose, status } = req.body;
    db.query("INSERT INTO appointments (client_id, appointment_date, purpose, status) VALUES (?, ?, ?, ?)", [client_id, appointment_date, purpose, status], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database Error" });
        res.json({ success: true, message: "Appointment scheduled!" });
    });
});

app.delete('/api/appointments/:id', (req, res) => {
    db.query("DELETE FROM appointments WHERE appointment_id = ?", [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.get('/api/stats/summary', (req, res) => {
    db.query("SELECT (SELECT COUNT(*) FROM clients) as totalClients, (SELECT COUNT(*) FROM violations) as totalViolations, (SELECT COUNT(*) FROM appointments) as totalAppointments, (SELECT COALESCE(SUM(penalty_amount), 0) FROM violations) as totalRevenue", (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(results[0]);
    });
});

// --- NAVIGATION ---
app.get('/dashboard.html', protect, (req, res) => res.sendFile(path.join(__dirname, "../frontend/dashboard.html")));
app.get('/clients.html', protect, (req, res) => res.sendFile(path.join(__dirname, "../frontend/clients.html")));
app.get('/appointments.html', protect, (req, res) => res.sendFile(path.join(__dirname, "../frontend/appointments.html")));
app.get('/violations.html', protect, (req, res) => res.sendFile(path.join(__dirname, "../frontend/violations.html")));

// ✅ SAFE SETTLE ROUTE - No crash, call PHP to sync dvats_db
app.put('/api/violations/pay/:id', (req, res) => {
    const violationId = req.params.id;
    const sql = "UPDATE violations SET status = 'Paid', updated_at = NOW() WHERE id = ?";
    db.query(sql, [violationId], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database Error" });
        
        // Success agad
        res.json({ success: true, message: "Fine marked as paid!" });
        
        // Try to sync via PHP (non-blocking)
        try {
            const https = require('https');
            const postData = JSON.stringify({ id: violationId });
            const options = {
                hostname: 'dvats-api-php.onrender.com',
                path: '/settle_violation.php',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
            };
            const reqSync = https.request(options, () => {});
            reqSync.on('error', (e) => console.warn('⚠️ PHP sync failed:', e.message));
            reqSync.write(postData);
            reqSync.end();
        } catch (e) {
            console.warn('⚠️ PHP sync error:', e.message);
        }
    });
});

// --- RECENT ACTIVITY ---
app.get('/api/stats/recent-activity', (req, res) => {
    const sql = `(SELECT 'CLIENT' as type, CONCAT('Registered: ', fullname) as description, reg_date as activity_date, 'REGISTERED' as status FROM clients) UNION ALL (SELECT 'VIOLATION' as type, CONCAT(fullname, ' - ', violation_type) as description, violation_date as activity_date, v.status FROM violations v JOIN clients c ON v.client_id = c.client_id) UNION ALL (SELECT 'APPOINTMENT' as type, CONCAT(fullname, ' - ', purpose) as description, appointment_date as activity_date, a.status FROM appointments a JOIN clients c ON a.client_id = c.client_id) ORDER BY activity_date DESC LIMIT 15`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// --- LOGOUT ---
app.get('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ success: false, message: "Could not log out" });
        res.redirect('/login.html');
    });
});

// --- CLIENT REGISTRATION ---
app.post('/api/clients/register', async (req, res) => {
    try {
        const { fullname, age, gender, license_no, password, email, phone_number, face_data, finger_data } = req.body;
        const qrToken = `LTO-DVATS-${license_no}-${Date.now()}`;
        const qrImage = await QRCode.toDataURL(qrToken);
        const sql = `INSERT INTO clients (fullname, age, gender, license_no, password, email, phone_number, face_data, finger_data, qr_token, qr_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.query(sql, [fullname, age, gender, license_no, password, email, phone_number, face_data, finger_data, qrToken, qrImage], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: "DB Error: " + err.message });
            res.status(200).json({ success: true, message: "Client registered!", qrCodeData: qrImage });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to generate QR Code" });
    }
});

app.get('/api/clients/license/:licenseNo', (req, res) => {
    db.query("SELECT * FROM clients WHERE license_no = ?", [req.params.licenseNo], (err, result) => {
        if (err) return res.status(500).send(err);
        if (result.length === 0) return res.status(404).json({ message: "Not Found" });
        res.json(result[0]);
    });
});

// --- SECURE DELETE ---
app.delete('/api/clients/:id', (req, res) => {
    const clientId = req.params.id;
    if (!req.session.user || String(req.session.user.role).toLowerCase() !== 'admin') return res.status(403).json({ success: false, message: "Permission Denied" });
    db.query("SELECT COUNT(*) AS unpaidCount FROM violations WHERE client_id = ? AND status = 'Unpaid'", [clientId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Server Error" });
        if (results[0].unpaidCount > 0) return res.status(400).json({ success: false, message: `Cannot delete! ${results[0].unpaidCount} UNPAID violation(s).` });
        db.query("DELETE FROM violations WHERE client_id = ?", [clientId], () => {
            db.query("DELETE FROM appointments WHERE client_id = ?", [clientId], () => {
                db.query("DELETE FROM clients WHERE client_id = ?", [clientId], (err3, result) => {
                    if (err3) return res.status(500).json({ success: false, message: "Database Error" });
                    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Client not found." });
                    res.json({ success: true, message: "Client deleted." });
                });
            });
        });
    });
});

// --- STAFF ---
app.post('/api/auth/register-staff', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password required" });
    db.query("INSERT INTO admins (username, password, role) VALUES (?, ?, 'staff')", [email, password], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json({ success: true, message: "Staff account created!" });
    });
});

app.get('/api/auth/users', (req, res) => {
    db.query("SELECT id, username, role FROM admins", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/driver/my-violations', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'driver') return res.status(401).json({ success: false, message: "Unauthorized" });
    db.query("SELECT * FROM violations WHERE client_id = ? ORDER BY violation_date DESC", [req.session.user.id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json({ success: true, violations: results });
    });
});

app.post('/api/driver/login', (req, res) => {
    const { license, password } = req.body;
    db.query("SELECT * FROM clients WHERE license_no = ?", [license], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (results.length > 0) {
            const driver = results[0];
            if (String(password) === String(driver.password)) {
                req.session.user = { id: driver.client_id, license: driver.license_no, name: driver.fullname || "Driver", role: 'driver' };
                return res.json({ success: true, driver: { name: driver.fullname || "Driver", license: driver.license_no, qr: driver.qr_image || "" } });
            } else return res.status(401).json({ success: false, message: "Maling password!" });
        } else return res.status(404).json({ success: false, message: "License not found!" });
    });
});

app.get('/api/driver/dashboard-data', (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const clientId = req.session.user.id;
    db.query(`SELECT (SELECT SUM(penalty_amount) FROM violations WHERE client_id = ? AND status = 'Paid') as totalPaid, (SELECT SUM(penalty_amount) FROM violations WHERE client_id = ? AND status = 'Unpaid') as unpaidFines, (SELECT license_no FROM clients WHERE client_id = ?) as license`, [clientId, clientId, clientId], (err, statsResult) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        db.query("SELECT * FROM violations WHERE client_id = ? ORDER BY violation_date DESC", [clientId], (err, violationsResult) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            db.query("SELECT * FROM appointments WHERE client_id = ? ORDER BY appointment_date ASC", [clientId], (err, appointmentsResult) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true, totalPaid: statsResult[0].totalPaid || 0, unpaidFines: statsResult[0].unpaidFines || 0, violations: violationsResult, appointments: appointmentsResult });
            });
        });
    });
});

// --- ENFORCER OTP ---
app.post('/api/enforcer/verify-badge', (req, res) => {
    const { badge_number } = req.body;
    if (!badge_number) return res.status(400).json({ message: "Badge number required" });
    dvats_db.query("SELECT status FROM enforcers WHERE badge_number = ?", [badge_number], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length === 0) return res.status(404).json({ message: "Badge not registered" });
        const enforcer = rows[0];
        if (enforcer.status === 'LOCKED') return res.status(403).json({ message: "Account locked" });
        if (enforcer.status === 'ACTIVE') return res.status(400).json({ message: "Already active" });
        const simulatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
        dvats_db.query("UPDATE enforcers SET registration_otp = ?, otp_attempts = 0 WHERE badge_number = ?", [simulatedOTP, badge_number], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            res.status(200).json({ success: true, message: "OTP generated", otp: simulatedOTP });
        });
    });
});

app.post('/api/enforcer/verify-otp', (req, res) => {
    const { badge_number, otp } = req.body;
    dvats_db.query("SELECT registration_otp, otp_attempts, status FROM enforcers WHERE badge_number = ?", [badge_number], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length === 0) return res.status(404).json({ message: "Not found" });
        const enforcer = rows[0];
        if (enforcer.status === 'LOCKED') return res.status(403).json({ message: "Account locked" });
        if (enforcer.registration_otp === otp) {
            dvats_db.query("UPDATE enforcers SET registration_otp = NULL, otp_attempts = 0 WHERE badge_number = ?", [badge_number], () => res.status(200).json({ success: true, message: "OTP verified" }));
        } else {
            const nextAttempts = enforcer.otp_attempts + 1;
            if (nextAttempts >= 2) {
                dvats_db.query("UPDATE enforcers SET status = 'LOCKED', registration_otp = NULL, otp_attempts = ? WHERE badge_number = ?", [nextAttempts, badge_number], () => res.status(423).json({ message: "Account locked" }));
            } else {
                dvats_db.query("UPDATE enforcers SET otp_attempts = ? WHERE badge_number = ?", [nextAttempts, badge_number], () => res.status(400).json({ message: "Invalid OTP" }));
            }
        }
    });
});

app.post('/api/enforcer/activate-account', (req, res) => {
    const { badge_number, password } = req.body;
    dvats_db.query("UPDATE enforcers SET password = ?, status = 'ACTIVE' WHERE badge_number = ?", [password, badge_number], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows > 0) return res.status(200).json({ success: true, message: "Account activated" });
        else return res.status(400).json({ message: "Failed" });
    });
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});