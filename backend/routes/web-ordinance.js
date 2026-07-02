const express = require('express');
const router = express.Router();
const db = require('../db');

// READ ALL
router.get('/read', (req, res) => {
    db.query("SELECT * FROM master_violations ORDER BY created_at DESC", (err, results) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: results });
    });
});

// CREATE
router.post('/create', (req, res) => {
    const { ordinance_no, violation_name, first_offense, second_offense, third_offense } = req.body;
    db.query("INSERT INTO master_violations (ordinance_no, violation_name, first_offense, second_offense, third_offense) VALUES (?,?,?,?,?)", 
    [ordinance_no, violation_name, first_offense, second_offense, third_offense], (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'Violation added.', id: result.insertId });
    });
});

// UPDATE
router.post('/update', (req, res) => {
    const { id, ordinance_no, violation_name, first_offense, second_offense, third_offense } = req.body;
    db.query("UPDATE master_violations SET ordinance_no=?, violation_name=?, first_offense=?, second_offense=?, third_offense=? WHERE id=?", 
    [ordinance_no, violation_name, first_offense, second_offense, third_offense, id], (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'Violation updated.' });
    });
});

// DELETE
router.post('/delete', (req, res) => {
    const { id } = req.body;
    db.query("DELETE FROM master_violations WHERE id=?", [id], (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'Violation deleted.' });
    });
});

module.exports = router;