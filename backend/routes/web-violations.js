const express = require('express');
const path = require('path');
const fs = require('fs');

// ✅ Export a function that accepts db connections
module.exports = function(db, dvats_db) {
    const router = express.Router();

    // 1. Get All Violations
     router.get('/all', (req, res) => {
        const sql = `SELECT id, ticket_no, license_no, badge_number, driver_name, violation_name, 
                     fine_amount, penalty_amount, status, is_registered, client_id, 
                     proof_type, created_at, updated_at,
                     CASE WHEN violation_photo IS NOT NULL AND violation_photo != '' THEN 1 ELSE 0 END as has_violation_photo,
                     CASE WHEN enforcer_proof IS NOT NULL AND enforcer_proof != '' THEN 1 ELSE 0 END as has_enforcer_proof
                     FROM violations 
                     WHERE id IN (SELECT MAX(id) FROM violations GROUP BY COALESCE(ticket_no, id)) 
                     ORDER BY created_at DESC`;
        db.query(sql, (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        });
    });

    // 2. Add Violation (Kambal Sync)
    router.post('/add', async (req, res) => {
        const { driver_name, license_no, violation_types, penalty_amount, badge_number, violation_photo, enforcer_proof, proof_type } = req.body;
        const ticket_no = "DVATS-" + Math.random().toString(36).substr(2, 6).toUpperCase();

        try {
            const client = await new Promise((resolve) => db.query("SELECT client_id, fullname FROM clients WHERE license_no = ?", [license_no], (e, r) => resolve(r ? r[0] : null)));
            const client_id = client ? client.client_id : null;
            const final_name = client ? client.fullname : (driver_name || "UNKNOWN");
            const is_registered = client ? 1 : 0;

            const values = [ticket_no, license_no, badge_number, final_name, violation_types, penalty_amount, 'PENDING', is_registered, client_id, violation_photo, enforcer_proof, proof_type];
            
            // ✅ Insert sa lto_system.violations
            db.query("INSERT INTO violations (ticket_no, license_no, badge_number, driver_name, violation_name, fine_amount, status, is_registered, client_id, violation_photo, enforcer_proof, proof_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", values);
            
            // ✅ Insert sa dvats_db.apprehensions (if dvats_db is available)
            if (dvats_db) {
                dvats_db.query("INSERT INTO apprehensions (ticket_no, license_no, badge_number, driver_name, violation_name, fine_amount, status, is_registered, client_id, violation_photo, enforcer_proof, proof_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", values);
            }

            res.json({ status: "success", ticket_no, driver_name: final_name });
        } catch (err) {
            res.json({ status: "error", message: err.message });
        }
    });

    // 3. Settle Violation (Kambal Sync)
    router.post('/pay', async (req, res) => {
        const { id } = req.body;
        try {
            const row = await new Promise((resolve) => db.query("SELECT ticket_no FROM violations WHERE id = ?", [id], (e, r) => resolve(r ? r[0] : null)));
            if (!row) throw new Error("Record not found");

            // ✅ Update lto_system.violations
            db.query("UPDATE violations SET status = 'PAID' WHERE id = ?", [id]);
            
            // ✅ Update dvats_db.apprehensions (if available)
            if (dvats_db) {
                dvats_db.query("UPDATE apprehensions SET status = 'PAID' WHERE ticket_no = ?", [row.ticket_no]);
            }
            
            res.json({ status: "success" });
        } catch (err) {
            res.json({ status: "error", message: err.message });
        }
    });

    // 4. Serve Image
    router.get('/serve-image', async (req, res) => {
        const imagePath = req.query.path;
        if (!imagePath) {
            res.setHeader('Content-Type', 'image/svg+xml');
            return res.send('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#f1f5f9" width="200" height="200"/><text x="100" y="105" text-anchor="middle" fill="#94a3b8" font-size="16">No image</text></svg>');
        }
        try {
            const phpApiUrl = 'https://dvats-api-php.onrender.com';
            const imageUrl = `${phpApiUrl}/serve-image.php?path=${encodeURIComponent(imagePath)}`;
            const https = require('https');
            const http = require('http');
            const client = imageUrl.startsWith('https') ? https : http;
            client.get(imageUrl, (proxyRes) => {
                if (proxyRes.statusCode === 404) {
                    res.setHeader('Content-Type', 'image/svg+xml');
                    return res.send('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#fef2f2" width="200" height="200"/><text x="100" y="95" text-anchor="middle" fill="#ef4444" font-size="14">Image not found</text></svg>');
                }
                res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                proxyRes.pipe(res);
            }).on('error', (err) => {
                res.setHeader('Content-Type', 'image/svg+xml');
                res.send('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#fef2f2" width="200" height="200"/><text x="100" y="95" text-anchor="middle" fill="#ef4444" font-size="14">Service unavailable</text></svg>');
            });
        } catch (err) {
            res.status(500).send('Error serving image');
        }
    });

    return router;
};