const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "lto_system"
});

db.connect(err => {
    if (err) {
        console.error("DB CONNECTION FAILED:", err);
    } else {
        console.log("Connected to MySQL");
    }
});

module.exports = db;
