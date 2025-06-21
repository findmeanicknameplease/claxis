-- Initialize n8n database with proper settings
CREATE DATABASE n8n;

-- Switch to n8n database
\c n8n;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions to n8n user
GRANT ALL PRIVILEGES ON DATABASE n8n TO n8n_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO n8n_user;

-- Set timezone
SET timezone = 'Europe/Berlin';