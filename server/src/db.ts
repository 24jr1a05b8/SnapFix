import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  const dbPath = path.join(__dirname, '..', 'antigravity.sqlite');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Turn on foreign key support
  await db.run('PRAGMA foreign_keys = ON');

  // Initialize schemas
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_identities (
      id TEXT PRIMARY KEY,
      mobile_signature TEXT UNIQUE NOT NULL,
      electronic_mail TEXT UNIQUE,
      legal_name TEXT NOT NULL,
      account_class TEXT NOT NULL DEFAULT 'customer',
      timestamp_created TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS technician_profiles (
      id TEXT PRIMARY KEY REFERENCES user_identities(id) ON DELETE CASCADE,
      verification_clearance_status INTEGER DEFAULT 0,
      specialization_vectors TEXT NOT NULL, -- JSON array of specializations
      current_latitude REAL,
      current_longitude REAL,
      aggregate_rating_score REAL DEFAULT 5.0
    );

    CREATE TABLE IF NOT EXISTS service_bookings (
      id TEXT PRIMARY KEY,
      customer_identity_id TEXT REFERENCES user_identities(id) NOT NULL,
      assigned_technician_id TEXT REFERENCES technician_profiles(id),
      current_state TEXT NOT NULL DEFAULT 'awaiting_bids',
      origin_latitude REAL NOT NULL,
      origin_longitude REAL NOT NULL,
      ai_analysis_summary_json TEXT,
      escrow_held_price_cents INTEGER NOT NULL,
      handshake_verification_hash TEXT NOT NULL,
      timestamp_created TEXT DEFAULT CURRENT_TIMESTAMP,
      timestamp_updated TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default test user identities and technician profiles if empty
  const userCount = await db.get('SELECT COUNT(*) as count FROM user_identities');
  if (userCount && userCount.count === 0) {
    // 1. Stranded Commuter / Customer Identity
    const commuterId = 'c8b417e0-47b2-4dbe-a1c1-1e96996614a1';
    await db.run(`
      INSERT INTO user_identities (id, mobile_signature, electronic_mail, legal_name, account_class)
      VALUES (?, ?, ?, ?, ?)
    `, [commuterId, '+15550101', 'commuter@antigravity.app', 'Alex Carter', 'customer']);

    // 2. Field Technician Identities & Profiles
    const tech1Id = 't7b417e0-47b2-4dbe-a1c1-1e96996614a2';
    await db.run(`
      INSERT INTO user_identities (id, mobile_signature, electronic_mail, legal_name, account_class)
      VALUES (?, ?, ?, ?, ?)
    `, [tech1Id, '+15550202', 'tech1@antigravity.app', 'Marcus Vane', 'technician']);
    await db.run(`
      INSERT INTO technician_profiles (id, verification_clearance_status, specialization_vectors, current_latitude, current_longitude, aggregate_rating_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [tech1Id, 1, JSON.stringify(['hybrid_powertrain', 'braking_systems', 'diagnostics']), 37.7749, -122.4194, 4.95]);

    const tech2Id = 't7b417e0-47b2-4dbe-a1c1-1e96996614a3';
    await db.run(`
      INSERT INTO user_identities (id, mobile_signature, electronic_mail, legal_name, account_class)
      VALUES (?, ?, ?, ?, ?)
    `, [tech2Id, '+15550303', 'tech2@antigravity.app', 'Sarah Jenkins', 'technician']);
    await db.run(`
      INSERT INTO technician_profiles (id, verification_clearance_status, specialization_vectors, current_latitude, current_longitude, aggregate_rating_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [tech2Id, 1, JSON.stringify(['electrical_systems', 'battery_service', 'towing_recovery']), 37.7833, -122.4167, 4.88]);

    const tech3Id = 't7b417e0-47b2-4dbe-a1c1-1e96996614a4';
    await db.run(`
      INSERT INTO user_identities (id, mobile_signature, electronic_mail, legal_name, account_class)
      VALUES (?, ?, ?, ?, ?)
    `, [tech3Id, '+15550404', 'tech3@antigravity.app', 'Dave Miller', 'technician']);
    await db.run(`
      INSERT INTO technician_profiles (id, verification_clearance_status, specialization_vectors, current_latitude, current_longitude, aggregate_rating_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [tech3Id, 1, JSON.stringify(['transmission_rebuild', 'engine_mechanics', 'brake_replacement']), 37.7650, -122.4400, 4.79]);
  }

  return db;
}
