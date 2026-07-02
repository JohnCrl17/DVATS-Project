const express = require('express');
const router = express.Router();
const db = require('../db'); // Siguraduhin na tama ang path ng db.js
const bcrypt = require('bcrypt');

router.post('/insert_enforcer', async (req, res) => {
    try {
        const { fullname, badge_no, unit, password, dob, gender, email, phone_number, face_data, qr_image } = req.body;

        // Validation
        if (!fullname || !badge_no || !unit || !password) {
            return res.status(200).json({ status: "error", message: "Required fields missing." });
        }

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // SQL Query
        const sql = `INSERT INTO enforcers (full_name, badge_number, unit, password, dob, gender, email, phone_number, face_token, qr_code_token, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`;

        db.query(sql, [fullname, badge_no, unit, hashedPassword, dob, gender, email, phone_number, face_data, qr_image], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.json({ status: "error", message: "Badge Number or Email already registered." });
                }
                return res.json({ status: "error", message: "Database error: " + err.message });
            }
            res.json({ status: "success", message: "Enforcer successfully enrolled." });
        });

    } catch (error) {
        res.json({ status: "error", message: error.message });
    }
});

module.exports = router;