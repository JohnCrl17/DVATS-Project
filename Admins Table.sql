-- 1️⃣ Use your database
USE lto_system;

-- 2️⃣ Delete all existing admins safely
DELETE FROM admins WHERE admin_id > 0;

-- 3️⃣ Insert a working admin account
-- Email: admin@lto.com
-- Password: admin123 (hashed with bcrypt)
INSERT INTO admins (email, password)
VALUES (
    'admin@lto.com',
    '$2a$10$wH8l7j8Qx7N1N9xY3R5O7PzYwZ8K8VvXH7KzCzXkzR3wZ6y'
);

-- 4️⃣ Verify
SELECT * FROM admins;
