const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');

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

// ✅ FIXED: Serve Image Route (converted from PHP logic)
router.get('/serve-image', (req, res) => {
    const imagePath = req.query.path;

    if (!imagePath) {
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#f1f5f9" width="200" height="200"/><text x="100" y="105" text-anchor="middle" fill="#94a3b8" font-size="16">No image</text></svg>');
    }

    // Decode URL-encoded path
    const decodedPath = decodeURIComponent(imagePath);
    
    // Extract filename
    const filename = path.basename(decodedPath);
    
    // Determine which folder based on path
    let filePath;
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    
    if (decodedPath.includes('violation')) {
        filePath = path.join(uploadsDir, 'violation', filename);
    } else if (decodedPath.includes('proof')) {
        filePath = path.join(uploadsDir, 'proof', filename);
    } else {
        // Try common folders first
        if (fs.existsSync(path.join(uploadsDir, 'violation', filename))) {
            filePath = path.join(uploadsDir, 'violation', filename);
        } else if (fs.existsSync(path.join(uploadsDir, 'proof', filename))) {
            filePath = path.join(uploadsDir, 'proof', filename);
        } else {
            filePath = path.join(uploadsDir, filename);
        }
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error('❌ Image not found:', filePath);
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#fef2f2" width="200" height="200"/><text x="100" y="95" text-anchor="middle" fill="#ef4444" font-size="14">File not found</text><text x="100" y="115" text-anchor="middle" fill="#94a3b8" font-size="10">${filename}</text></svg>`);
    }

    // Determine MIME type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp'
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    // Set headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Send file
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('❌ Error sending file:', err);
            if (!res.headersSent) {
                res.status(500).send('Error serving image');
            }
        }
    });
});

module.exports = router;