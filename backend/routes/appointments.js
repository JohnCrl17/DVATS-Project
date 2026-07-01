const express = require("express");
const router = express.Router();
const db = require("../db");

// 1. GET ALL APPOINTMENTS (Updated with SQL JOIN to get Client Names)
router.get("/", (req, res) => {
    // We use a JOIN to fetch the fullname from the clients table 
    // based on the client_id stored in the appointments table.
    const sql = `
        SELECT 
            appointments.appointment_id, 
            appointments.appointment_date, 
            appointments.purpose, 
            appointments.status, 
            appointments.client_id,
            clients.fullname 
        FROM appointments
        JOIN clients ON appointments.client_id = clients.client_id
        ORDER BY appointments.appointment_date DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// 2. ADD NEW APPOINTMENT
router.post("/", (req, res) => {
    const { client_id, appointment_date, purpose, status } = req.body;
    const sql = "INSERT INTO appointments (client_id, appointment_date, purpose, status) VALUES (?, ?, ?, ?)";
    
    db.query(sql, [client_id, appointment_date, purpose, status || 'Scheduled'], (err, result) => {
        if (err) {
            console.error("Insert Error:", err);
            return res.status(500).json({ error: err.message });
        }
        res.status(200).json({ message: "Appointment scheduled!" });
    });
});

// 3. DELETE APPOINTMENT
router.delete("/:id", (req, res) => {
    const sql = "DELETE FROM appointments WHERE appointment_id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) {
            console.error("Delete Error:", err);
            return res.status(500).json({ error: err.message });
        }
        res.status(200).json({ message: "Deleted" });
    });
});

module.exports = router;