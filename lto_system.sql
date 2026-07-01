-- 1️⃣ Select the database (create if it doesn't exist)
CREATE DATABASE IF NOT EXISTS lto_system;
USE lto_system;

-- 2️⃣ Drop duplicate tables if they exist
DROP TABLE IF EXISTS `Admins Table`;  -- remove the wrong duplicate

-- 3️⃣ Create admins table
CREATE TABLE IF NOT EXISTS admins (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

-- 4️⃣ Insert a known admin account (email: admin@lto.com, password: admin123)
-- The password is hashed with bcrypt
DELETE FROM admins; -- remove old admins if any
INSERT INTO admins (email, password)
VALUES ('admin@lto.com', '$2b$10$kHf3vXJ9aT7lLkVdA1N9AuvhXqv3JkLfHZR8zR5Lk8v9mT1O4yP6C');

-- 5️⃣ Create clients table
CREATE TABLE IF NOT EXISTS clients (
    client_id INT AUTO_INCREMENT PRIMARY KEY,
    fullname VARCHAR(150) NOT NULL,
    license_no VARCHAR(50) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL
);

-- 6️⃣ Create violations table
CREATE TABLE IF NOT EXISTS violations (
    violation_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    violation_type VARCHAR(150) NOT NULL,
    penalty_amount DECIMAL(10,2) DEFAULT 0.00,
    status ENUM('Pending', 'Paid', 'Contested') DEFAULT 'Pending',
    violation_date DATE NOT NULL,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

-- 7️⃣ Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
    appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    purpose VARCHAR(150),
    status ENUM('Scheduled', 'Completed', 'Cancelled') DEFAULT 'Scheduled',
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);
CREATE TABLE violations (
    violation_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    violation_type VARCHAR(100) NOT NULL,
    fine_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('Unpaid', 'Paid') DEFAULT 'Unpaid',
    date_recorded TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

-- 8️⃣ Confirm tables
SHOW TABLES;

-- 9️⃣ Check the admin
SELECT * FROM admins;
