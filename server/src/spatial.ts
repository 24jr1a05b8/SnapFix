import { getDb } from './db';
import { TechnicianProfile } from './types';

/**
 * Calculates the geodetic distance between two coordinates using the Haversine formula
 * @returns Distance in kilometers
 */
export function getHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface NearbyTechnicianResponse extends TechnicianProfile {
  distance_km: number;
}

/**
 * Queries technician profiles and filters them by distance relative to a center node
 */
export async function findNearbyTechnicians(
  latitude: number,
  longitude: number,
  radiusKm: number = 10
): Promise<NearbyTechnicianResponse[]> {
  const db = await getDb();
  
  // Fetch active profiles with location coords
  const rows = await db.all(`
    SELECT 
      tp.id, 
      tp.verification_clearance_status, 
      tp.specialization_vectors, 
      tp.current_latitude, 
      tp.current_longitude, 
      tp.aggregate_rating_score,
      ui.legal_name,
      ui.mobile_signature
    FROM technician_profiles tp
    JOIN user_identities ui ON tp.id = ui.id
    WHERE tp.current_latitude IS NOT NULL 
      AND tp.current_longitude IS NOT NULL
      AND tp.verification_clearance_status = 1
  `);

  const results: NearbyTechnicianResponse[] = [];

  for (const row of rows) {
    const dist = getHaversineDistance(
      latitude,
      longitude,
      row.current_latitude,
      row.current_longitude
    );

    if (dist <= radiusKm) {
      results.push({
        id: row.id,
        verification_clearance_status: !!row.verification_clearance_status,
        specialization_vectors: JSON.parse(row.specialization_vectors),
        current_latitude: row.current_latitude,
        current_longitude: row.current_longitude,
        aggregate_rating_score: row.aggregate_rating_score,
        legal_name: row.legal_name,
        mobile_signature: row.mobile_signature,
        distance_km: parseFloat(dist.toFixed(3))
      });
    }
  }

  // Sort by closest distance
  return results.sort((a, b) => a.distance_km - b.distance_km);
}
