const express = require('express');
const router = express.Router();
const db = require('../db'); // Your database connection

// Route to get dashboard counts
router.get('/summary', (req, res) => {
    const queries = {
        totalClients: "SELECT COUNT(*) as count FROM clients",
        totalViolations: "SELECT COUNT(*) as count FROM violations",
        totalAppointments: "SELECT COUNT(*) as count FROM appointments"
    };

    // Run multiple queries at once
    db.query(`${queries.totalClients}; ${queries.totalViolations}; ${queries.totalAppointments}`, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
            totalClients: results[0][0].count,
            totalViolations: results[1][0].count,
            totalAppointments: results[2][0].count
        });
    });
});

module.exports = router;