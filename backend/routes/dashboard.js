const express = require("express");
const router = express.Router();
const db = require("../db");

// Route to get counts for the dashboard cards
router.get("/stats", (req, res) => {
    // This query counts records from all three tables at once
    const sql = `
        SELECT 
            (SELECT COUNT(*) FROM clients) as totalClients,
            (SELECT COUNT(*) FROM violations) as pendingViolations,
            (SELECT COUNT(*) FROM appointments) as todayAppointments
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Dashboard Stats Error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        // Return the first row of the results
        res.json(results[0]);
    });
});

module.exports = router;