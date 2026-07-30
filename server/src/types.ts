export type UserAccountClass = 'customer' | 'technician' | 'admin_operator';
export type OperationalJobState = 'awaiting_bids' | 'assigned' | 'transit' | 'active_repair' | 'finalized' | 'aborted';

export interface UserIdentity {
  id: string;
  mobile_signature: string;
  electronic_mail: string | null;
  legal_name: string;
  account_class: UserAccountClass;
  timestamp_created?: string;
}

export interface TechnicianProfile {
  id: string;
  verification_clearance_status: boolean;
  specialization_vectors: string[]; // parsed from JSON
  current_latitude: number | null;
  current_longitude: number | null;
  aggregate_rating_score: number;
  legal_name?: string; // from join
  mobile_signature?: string; // from join
}

export interface AIDiagnosticSummary {
  fault_code: string;
  confidence: number;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  estimated_cost_cents_range: [number, number];
  recommended_actions: string[];
}

export interface ServiceBooking {
  id: string;
  customer_identity_id: string;
  assigned_technician_id: string | null;
  current_state: OperationalJobState;
  origin_latitude: number;
  origin_longitude: number;
  ai_analysis_summary_json: AIDiagnosticSummary | null;
  escrow_held_price_cents: number;
  handshake_verification_hash: string;
  timestamp_created?: string;
  timestamp_updated?: string;
}

// WebSocket message formats
export interface LocationUpdateMessage {
  type: 'LOCATION_UPDATE';
  latitude: number;
  longitude: number;
}

export interface AcceptJobMessage {
  type: 'ACCEPT_JOB';
  bookingId: string;
}

export interface UpdateJobStateMessage {
  type: 'UPDATE_JOB_STATE';
  bookingId: string;
  state: OperationalJobState;
}

export interface HandshakeTokenMessage {
  type: 'SUBMIT_HANDSHAKE';
  bookingId: string;
  token: string;
}
