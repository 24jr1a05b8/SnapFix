-- Core Schema Initializations
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- System Domain Type Declarations
CREATE TYPE user_account_class AS ENUM ('customer', 'technician', 'admin_operator');
CREATE TYPE operational_job_state AS ENUM ('awaiting_bids', 'assigned', 'transit', 'active_repair', 'finalized', 'aborted');

-- Core Identity Container Table
CREATE TABLE user_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mobile_signature VARCHAR(16) UNIQUE NOT NULL,
    electronic_mail VARCHAR(255) UNIQUE,
    legal_name VARCHAR(128) NOT NULL,
    account_class user_account_class NOT NULL DEFAULT 'customer',
    timestamp_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Extended Field Technician Configuration
CREATE TABLE technician_profiles (
    id UUID PRIMARY KEY REFERENCES user_identities(id) ON DELETE CASCADE,
    verification_clearance_status BOOLEAN DEFAULT FALSE,
    specialization_vectors VARCHAR(64)[] NOT NULL, -- e.g., ['hybrid_powertrain', 'braking_systems']
    current_spatial_node GEOMETRY(Point, 4326),
    aggregate_rating_score NUMERIC(3,2) DEFAULT 5.00
);

-- Core System Transactional Log Ledger
CREATE TABLE service_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_identity_id UUID REFERENCES user_identities(id) NOT NULL,
    assigned_technician_id UUID REFERENCES technician_profiles(id),
    current_state operational_job_state NOT NULL DEFAULT 'awaiting_bids',
    origin_geospatial_node GEOMETRY(Point, 4326) NOT NULL,
    ai_analysis_summary_json JSONB,
    escrow_held_price_cents INTEGER NOT NULL, -- Numeric absolute precision tracking via base unit integers
    handshake_verification_hash VARCHAR(64) NOT NULL,
    timestamp_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    timestamp_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Optimization Indexes
CREATE INDEX idx_user_identities_mobile ON user_identities(mobile_signature);
CREATE INDEX idx_spatial_technician_node ON technician_profiles USING GIST(current_spatial_node);
CREATE INDEX idx_bookings_state ON service_bookings(current_state);
