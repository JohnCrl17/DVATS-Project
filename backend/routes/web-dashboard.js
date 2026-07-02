const express = require('express');
const router = express.Router();
const db = require('../db');

// Route para sa summary (dating summary.php)
router.get('/summary', (req, res) => {
    const sql = `
        SELECT 
            (SELECT COUNT(*) FROM violations WHERE is_registered = 1 OR (is_registered = 0 AND ticket_no NOT IN (SELECT ticket_no FROM violations WHERE is_registered = 1))) as totalViolations,
            (SELECT COUNT(*) FROM appointments) as totalAppointments,
            (SELECT COUNT(*) FROM clients) as totalClients,
            (SELECT COUNT(*) FROM enforcers) as totalEnforcers`;

    db.query(sql, (err, result) => {
        if (err) return res.status(500).json({ error: "Query failed", details: err.message });
        res.json(result[0]);
    });
});

// Route para sa recent activity (dating recent-activity.php)
router.get('/recent-activity', (req, res) => {
    const sql = `
        SELECT 
            'Violations' AS type, 
            CONCAT(violation_name, ' - ', driver_name) AS description, 
            status, 
            created_at AS activity_date 
        FROM violations 
        WHERE is_registered = 1 
        OR (is_registered = 0 AND ticket_no NOT IN (SELECT ticket_no FROM violations WHERE is_registered = 1))
        ORDER BY created_at DESC 
        LIMIT 10`;

    db.query(sql, (err, result) => {
        if (err) return res.status(500).json({ error: "Query failed", details: err.message });
        res.json(result);
    });
});

module.exports = router;