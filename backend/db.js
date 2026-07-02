const mysql = require("mysql2");

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
});

// Sa db.js, palitan ang connection block mo ng ganito:
db.connect(err => {
    if (err) {
        console.error("❌ DB CONNECTION FAILED! Detalye:", err.message);
        console.error("Host:", process.env.DB_HOST); // Para ma-check natin sa logs kung null ba
    } else {
        console.log("✅ Connected to MySQL (Cloud)");
    }
});

module.exports = db;