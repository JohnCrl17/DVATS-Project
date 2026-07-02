require('dotenv').config(); // Ito dapat ang una!
const mysql = require("mysql2");

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER, // <--- Siguraduhin na nandito ito
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
});

db.connect(err => {
    if (err) {
        console.error("❌ DB CONNECTION FAILED! Detalye:", err.message);
        console.error("Host:", process.env.DB_HOST); 
    } else {
        console.log("✅ Connected to MySQL (Cloud)");
    }
});

module.exports = db;