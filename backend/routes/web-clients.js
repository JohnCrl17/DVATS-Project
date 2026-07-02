const express = require('express');
const router = express.Router();
const db = require('../db');
const axios = require('axios'); // Para sa SMS API (curl replacement)

// 1. Get All Clients
router.get('/get_clients', (req, res) => {
    db.query("SELECT * FROM clients ORDER BY reg_date DESC", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 2. Get Client Details
router.get('/get_details', (req, res) => {
    const { id } = req.query;
    db.query("SELECT * FROM clients WHERE client_id = ?", [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.json({ error: "Client not found" });
        
        let client = results[0];
        // Fix column mismatch (face_date -> face_data)
        if (client.face_date && !client.face_data) client.face_data = client.face_date;
        res.json(client);
    });
});

// 3. Get Client History
router.get('/get_history', (req, res) => {
    const { id } = req.query;
    db.query("SELECT violation_name, created_at, status FROM violations WHERE client_id = ? ORDER BY created_at DESC", [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 4. Send SMS (Semaphore API)
router.post('/send_sms', async (req, res) => {
    const { number, message } = req.body;
    try {
        const response = await axios.post('https://api.semaphore.co/api/v4/messages', {
            apikey: "399585c088a0f0d485a95e24623f068e",
            number: number,
            message: message,
            sendername: 'DVATS'
        });
        res.json({ success: true, response: response.data });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// 5. Delete Client
router.delete('/delete_client', async (req, res) => {
    const { id } = req.query;
    try {
        // Query to get name
        const client = await new Promise((resolve) => db.query("SELECT fullname FROM clients WHERE client_id = ?", [id], (e, r) => resolve(r[0])));
        
        if (client) {
            db.query("DELETE FROM violations WHERE driver_name = ?", [client.fullname]);
            db.query("DELETE FROM clients WHERE client_id = ?", [id], (err, result) => {
                if (err) throw err;
                res.json({ status: "success", message: "Deleted successfully." });
            });
        }
    } catch (err) {
        res.json({ status: "error", message: err.message });
    }
});

module.exports = router;