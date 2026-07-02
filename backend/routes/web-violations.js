const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Get All Violations
router.get('/all', (req, res) => {
    const sql = `SELECT * FROM violations WHERE id IN (SELECT MAX(id) FROM violations GROUP BY COALESCE(ticket_no, id)) ORDER BY created_at DESC`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 2. Add Violation (Kambal Sync Logic)
router.post('/add', async (req, res) => {
    const { driver_name, license_no, violation_types, penalty_amount, badge_number, violation_photo, enforcer_proof, proof_type } = req.body;
    const ticket_no = "DVATS-" + Math.random().toString(36).substr(2, 6).toUpperCase();

    try {
        // Find Client
        const client = await new Promise((resolve) => db.query("SELECT client_id, fullname FROM clients WHERE license_no = ?", [license_no], (e, r) => resolve(r[0])));
        const client_id = client ? client.client_id : null;
        const final_name = client ? client.fullname : (driver_name || "UNKNOWN");
        const is_registered = client ? 1 : 0;

        const values = [ticket_no, license_no, badge_number, final_name, violation_types, penalty_amount, 'PENDING', is_registered, client_id, violation_photo, enforcer_proof, proof_type];
        
        // Sync to both tables
        db.query("INSERT INTO apprehensions (ticket_no, license_no, badge_number, driver_name, violation_name, fine_amount, status, is_registered, client_id, violation_photo, enforcer_proof, proof_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", values);
        db.query("INSERT INTO violations (ticket_no, license_no, badge_number, driver_name, violation_name, fine_amount, status, is_registered, client_id, violation_photo, enforcer_proof, proof_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", values);

        res.json({ status: "success", ticket_no, driver_name: final_name });
    } catch (err) {
        res.json({ status: "error", message: err.message });
    }
});

// 3. Settle Violation (Update both)
router.post('/pay', async (req, res) => {
    const { id } = req.body;
    try {
        const row = await new Promise((resolve) => db.query("SELECT ticket_no FROM violations WHERE id = ?", [id], (e, r) => resolve(r[0])));
        if (!row) throw new Error("Record not found");

        db.query("UPDATE violations SET status = 'PAID' WHERE id = ?", [id]);
        db.query("UPDATE apprehensions SET status = 'PAID' WHERE ticket_no = ?", [row.ticket_no]);
        
        res.json({ status: "success" });
    } catch (err) {
        res.json({ status: "error", message: err.message });
    }
});

module.exports = router;