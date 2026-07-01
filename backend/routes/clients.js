const express = require("express");
const router = express.Router();
const db = require("../db");
const QRCode = require('qrcode'); // Import para sa QR Generation

// --- 1. MIDDLEWARE: ADMIN CHECK ---
const isAdmin = (req, res, next) => {
    // Chine-check kung ang user ay logged in at kung 'admin' ang role
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        next(); // Proceed sa susunod na function
    } else {
        res.status(403).json({ success: false, message: "Access Denied: Admins Only" });
    }
};

// --- 2. GET ALL CLIENTS (Para sa Dashboard Table) ---
router.get("/all", (req, res) => {
    // Kinuha natin ang basic info pati age/gender para sa table
    const sql = "SELECT client_id, fullname, license_no, phone_number, age, gender, reg_date FROM clients ORDER BY reg_date DESC";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// --- 3. GET SINGLE CLIENT (Para sa Profile Modal / Biometric View) ---
router.get("/:id", (req, res) => {
    const sql = "SELECT * FROM clients WHERE client_id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) {
            console.error("Fetch Error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(result[0]); // Ibinabalik ang isang client object
    });
});

// --- 4. REGISTER NEW CLIENT (With Biometrics & QR Generation) ---
router.post('/register', async (req, res) => {
    const { fullname, license_no, password, age, gender, email, phone_number, face_data, finger_data } = req.body;

    try {
        const qrToken = `LTO-DVATS-${license_no}-${Date.now()}`;
        const qrImage = await QRCode.toDataURL(qrToken);

        // Sinunod natin ang order sa HeidiSQL: 
        // fullname, age, gender, license_no, password, email, phone_number, face_data, finger_data, qr_token, qr_image
        const sql = `INSERT INTO clients 
            (fullname, age, gender, license_no, password, email, phone_number, face_data, finger_data, qr_token, qr_image) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [fullname, age, gender, license_no, password, email, phone_number, face_data, finger_data, qrToken, qrImage];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error("DB Error:", err);
                return res.status(500).json({ success: false, message: "Database Error" });
            }
            res.status(200).json({ 
                success: true, 
                qrCodeData: qrImage // Ito ang kailangan ng frontend para sa download
            });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "QR Generation Error" });
    }
});

// --- 5. UPDATE CLIENT INFO ---
router.put("/:id", (req, res) => {
    const { fullname, license_no, phone_number, age, gender } = req.body;
    const sql = "UPDATE clients SET fullname = ?, license_no = ?, phone_number = ?, age = ?, gender = ? WHERE client_id = ?";
    
    db.query(sql, [fullname, license_no, phone_number, age, gender, req.params.id], (err, result) => {
        if (err) {
            console.error("Update Error:", err);
            return res.status(500).json({ message: "Error updating client info" });
        }
        res.status(200).json({ message: "Client updated successfully" });
    });
});

// --- 6. DELETE CLIENT (Admin Protected) ---
router.delete("/:id", isAdmin, (req, res) => {
    const sql = "DELETE FROM clients WHERE client_id = ?"; 
    db.query(sql, [req.params.id], (err, result) => {
        if (err) {
            console.error("Delete Error:", err);
            return res.status(500).json({ message: "Database Error: Could not delete" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Client not found" });
        }
        res.status(200).json({ success: true, message: "Client deleted successfully" });
    });
});

module.exports = router;