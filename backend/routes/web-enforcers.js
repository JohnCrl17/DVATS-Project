const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. GET ALL ENFORCERS
router.get('/list', (req, res) => {
    db.query("SELECT id, full_name, badge_number, email, unit, status FROM enforcers ORDER BY id DESC", (err, results) => {
        if (err) return res.status(500).json([]);
        res.json(results);
    });
});

// 2. GET ENFORCER DETAILS
router.get('/details', (req, res) => {
    const { id } = req.query;
    db.query(`SELECT id, full_name, badge_number, email, unit, gender, dob, phone_number, status, 
              face_token AS face_data, qr_code_token AS qr_image 
              FROM enforcers WHERE id = ? LIMIT 1`, [id], (err, results) => {
        if (err || results.length === 0) return res.json({ error: "Enforcer not found" });
        res.json(results[0]);
    });
});

// 3. UPDATE STATUS
router.post('/update-status', (req, res) => {
    const { id, status } = req.body;
    db.query("UPDATE enforcers SET status = ? WHERE id = ?", [status, id], (err, result) => {
        if (err) return res.json({ success: false, message: err.message });
        res.json({ success: true });
    });
});

// 4. DELETE ENFORCER
router.post('/delete', (req, res) => {
    const { id } = req.body;
    db.query("DELETE FROM enforcers WHERE id = ?", [id], (err, result) => {
        if (err) return res.json({ status: "error", message: "Failed to delete" });
        res.json({ status: "success", message: "Officer deleted successfully." });
    });
});

module.exports = router;