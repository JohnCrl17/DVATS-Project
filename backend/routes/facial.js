const express = require("express");
const router = express.Router();
const db = require("../db");

// Register client face
router.post("/register", (req, res) => {
    const { client_id, image } = req.body;

    if(!client_id || !image) return res.json({ success: false, message: "Missing data" });

    // Convert base64 to buffer
    const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    // Save to DB
    db.query(
        "UPDATE clients SET face_encoding = ? WHERE client_id = ?",
        [buffer, client_id],
        (err) => {
            if(err) return res.json({ success: false, message: err.message });
            res.json({ success: true, message: "Face registered successfully!" });
        }
    );
});

// Get client faces (optional, for recognition)
router.get("/clients", (req, res) => {
    db.query("SELECT client_id, fullname, face_encoding FROM clients WHERE face_encoding IS NOT NULL", 
    (err, results) => {
        if(err) return res.status(500).json({ success: false, message: err.message });
        res.json(results);
    });
});

module.exports = router;
