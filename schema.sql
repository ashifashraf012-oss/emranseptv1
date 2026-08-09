-- Vercel Neon PostgreSQL Database Setup
-- You can copy and paste this into Neon Console SQL Editor or run via Vercel Postgres CLI

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'email_entered',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- 2. TAP Codes Table
CREATE TABLE IF NOT EXISTS tap_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default TAP Code if empty
INSERT INTO tap_codes (code) 
SELECT '22' 
WHERE NOT EXISTS (SELECT 1 FROM tap_codes);

-- 3. Admin Table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Admin (username: admin, password: admin123)
INSERT INTO admins (username, password) 
SELECT 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'admin');

-- Done! Neon Database Schema Ready.
