const express = require('express');
const router = express.Router();
const db = require('../db'); 
const bcrypt = require('bcrypt'); // Required for hashing

router.post("/login", (req, res) => {
    const { email, password } = req.body;

    // 1. Search for the user by email first
    const sql = "SELECT id, email, password, role FROM admins WHERE email = ?";
    
    db.query(sql, [email], async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });

        if (results.length > 0) {
            const user = results[0];
            let isMatch = false;

            // 2. Check if the password in DB is a Bcrypt hash (starts with $2b$)
            if (user.password.startsWith('$2b$')) {
                // Use bcrypt to compare the typed password with the hash
                isMatch = await bcrypt.compare(password, user.password);
            } else {
                // Fallback for your current Staff account (Plain Text)
                isMatch = (user.password === password);
            }

            if (isMatch) {
                // 3. Save to session
                req.session.user = {
                    id: user.id,
                    email: user.email,
                    role: user.role 
                };

                return res.json({ 
                    success: true, 
                    role: user.role 
                });
            } else {
                return res.status(401).json({ success: false, message: "Invalid password" });
            }
        } else {
            return res.status(401).json({ success: false, message: "Email not found" });
        }
    });
});

module.exports = router;