const express = require("express");
const router = express.Router();
const db = require("../db");

// GET: Fetch all violations
// GET ALL VIOLATIONS
router.get("/", (req, res) => {
    const sql = `
        SELECT v.violation_id, v.violation_type, v.penalty_amount, v.status, c.fullname 
        FROM violations v 
        JOIN clients c ON v.client_id = c.client_id
        ORDER BY v.violation_date DESC
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("SQL Error:", err.message);
            return res.status(500).json([]); 
        }
        res.json(results);
    });
});

// ADD NEW VIOLATION
router.post("/", (req, res) => {
    // Destructure the exact names from the frontend request
    const { client_id, violation_type, penalty_amount, violation_date } = req.body;

    // Use your exact DB column names: client_id, violation_type, penalty_amount, violation_date
    const sql = `INSERT INTO violations 
                (client_id, violation_type, penalty_amount, violation_date, status) 
                VALUES (?, ?, ?, ?, 'Pending')`;
    
    db.query(sql, [client_id, violation_type, penalty_amount, violation_date], (err, result) => {
        if (err) {
            console.error("SQL Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.status(200).json({ message: "Violation recorded!" });
    });
});

// DELETE: Remove a violation
router.delete("/:id", (req, res) => {
    const violationId = req.params.id;
    const sql = "DELETE FROM violations WHERE violation_id = ?";
    
    db.query(sql, [violationId], (err, result) => {
        if (err) {
            console.error("Delete Error:", err);
            return res.status(500).json({ message: "Database Error" });
        }
        res.status(200).json({ message: "Violation deleted" });
    });
});

module.exports = router;