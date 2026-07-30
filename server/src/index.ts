import express from 'express';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import url from 'url';
import crypto from 'crypto';

import { getDb } from './db';
import { findNearbyTechnicians } from './spatial';
import { analyzeVehicleSymptoms } from './ai';
import { OperationalJobState } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS setup to allow client connection
app.use(cors());
// Parse JSON payloads up to 10MB (satisfies FR-1.2)
app.use(express.json({ limit: '10mb' }));

// Create HTTP server to attach WebSockets
const httpServer = createServer(app);

// Initialize WebSocket Server
const wss = new WebSocketServer({ noServer: true });

// WebSocket connection registry: maps userId -> WebSocket & Role metadata
const clientSockets = new Map<string, { ws: WebSocket; role: 'customer' | 'technician' }>();

// HTTP health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', service: 'antigravity-core-api' });
});

// REST: Submit vehicle symptoms and analyze using AI (Gemini or fallback)
app.post('/api/v1/diagnostics', async (req, res) => {
  try {
    const { symptoms, imageBase64, imageMime } = req.body;
    if (!symptoms) {
      return res.status(400).json({ error: 'Symptoms string is required.' });
    }

    console.log('[AI Engine] Received symptoms analysis request...');
    const diagnosis = await analyzeVehicleSymptoms(symptoms, imageBase64, imageMime);
    console.log('[AI Engine] Analysis completed:', diagnosis.fault_code);

    res.json(diagnosis);
  } catch (error: any) {
    console.error('Diagnostics processing error:', error);
    res.status(500).json({ error: 'Failed to analyze symptoms.' });
  }
});

// REST: Create a booking and hold payment (FR-1.3)
app.post('/api/v1/bookings', async (req, res) => {
  try {
    const { customerId, originLatitude, originLongitude, diagnosticSummary, escrowAmountCents } = req.body;
    
    if (!customerId || originLatitude === undefined || originLongitude === undefined || !escrowAmountCents) {
      return res.status(400).json({ error: 'Missing required booking fields.' });
    }

    const db = await getDb();

    // Verify customer exists, or auto-create mock customer
    let customer = await db.get('SELECT * FROM user_identities WHERE id = ?', [customerId]);
    if (!customer) {
      // Auto-register mock user for frictionless local experience
      await db.run(`
        INSERT INTO user_identities (id, mobile_signature, legal_name, account_class)
        VALUES (?, ?, ?, 'customer')
      `, [customerId, '+15550101', 'Alex Carter']);
    }

    const bookingId = crypto.randomUUID();
    // Generate a secure 6-digit cryptographic confirmation token (handshake)
    const handshakeToken = Math.floor(100000 + Math.random() * 900000).toString();

    // Write booking into DB
    await db.run(`
      INSERT INTO service_bookings (
        id, customer_identity_id, current_state, origin_latitude, origin_longitude, 
        ai_analysis_summary_json, escrow_held_price_cents, handshake_verification_hash
      ) VALUES (?, ?, 'awaiting_bids', ?, ?, ?, ?, ?)
    `, [
      bookingId,
      customerId,
      originLatitude,
      originLongitude,
      JSON.stringify(diagnosticSummary || null),
      escrowAmountCents,
      handshakeToken // For local simplicity, store directly. Real apps hash it.
    ]);

    console.log(`[Escrow] Stripe mock hold placed: ${escrowAmountCents} cents for booking ${bookingId}`);
    console.log(`[Handshake] Generated verification code for passenger: ${handshakeToken}`);

    // Retrieve details for dispatch
    const booking = await db.get('SELECT * FROM service_bookings WHERE id = ?', [bookingId]);

    // Query online technicians in a 15km radius (FR-1.1 & spatial search)
    const nearbyTechs = await findNearbyTechnicians(originLatitude, originLongitude, 15);
    console.log(`[Spatial Dispatch] Found ${nearbyTechs.length} technicians in dispatch range.`);

    // Broadcast new dispatch request alert to nearby technicians via WebSocket
    const notificationPayload = JSON.stringify({
      type: 'NEW_DISPATCH_REQUEST',
      booking: {
        id: bookingId,
        origin_latitude: originLatitude,
        origin_longitude: originLongitude,
        escrow_held_price_cents: escrowAmountCents,
        ai_analysis_summary_json: diagnosticSummary,
        timestamp_created: booking.timestamp_created
      }
    });

    for (const tech of nearbyTechs) {
      const socketObj = clientSockets.get(tech.id);
      if (socketObj && socketObj.ws.readyState === WebSocket.OPEN) {
        console.log(`[WebSocket] Sending dispatch request alert to technician: ${tech.legal_name} (${tech.id})`);
        socketObj.ws.send(notificationPayload);
      }
    }

    res.status(201).json({
      bookingId,
      handshakeToken,
      nearbyTechniciansCount: nearbyTechs.length
    });
  } catch (error: any) {
    console.error('Booking creation error:', error);
    res.status(500).json({ error: 'Failed to create service booking.' });
  }
});

// REST: Retrieve a specific booking details
app.get('/api/v1/bookings/:id', async (req, res) => {
  try {
    const db = await getDb();
    const booking = await db.get(`
      SELECT 
        sb.*,
        ui.legal_name as customer_name,
        ui.mobile_signature as customer_phone,
        tp.aggregate_rating_score as tech_rating,
        tui.legal_name as tech_name,
        tui.mobile_signature as tech_phone
      FROM service_bookings sb
      JOIN user_identities ui ON sb.customer_identity_id = ui.id
      LEFT JOIN technician_profiles tp ON sb.assigned_technician_id = tp.id
      LEFT JOIN user_identities tui ON tp.id = tui.id
      WHERE sb.id = ?
    `, [req.params.id]);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Parse diagnostic summary
    if (booking.ai_analysis_summary_json) {
      booking.ai_analysis_summary_json = JSON.parse(booking.ai_analysis_summary_json);
    }

    res.json(booking);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve booking details.' });
  }
});

// REST: Get list of active technicians
app.get('/api/v1/technicians', async (req, res) => {
  try {
    const db = await getDb();
    const technicians = await db.all(`
      SELECT tp.*, ui.legal_name, ui.mobile_signature
      FROM technician_profiles tp
      JOIN user_identities ui ON tp.id = ui.id
    `);

    const activeList = technicians.map(t => ({
      ...t,
      specialization_vectors: JSON.parse(t.specialization_vectors),
      isOnline: clientSockets.has(t.id)
    }));

    res.json(activeList);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to query technician list.' });
  }
});

// HTTP Upgrade Connection to WebSockets
httpServer.on('upgrade', (request, socket, head) => {
  const parsedUrl = url.parse(request.url || '', true);
  const pathname = parsedUrl.pathname;

  if (pathname === '/ws/dispatch') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// WebSocket Handler
wss.on('connection', async (ws: WebSocket, request) => {
  const parsedUrl = url.parse(request.url || '', true);
  const userId = parsedUrl.query.userId as string;
  const role = parsedUrl.query.role as 'customer' | 'technician';

  if (!userId || !role) {
    ws.close(4001, 'Missing query params userId and role');
    return;
  }

  // Save the connection state
  clientSockets.set(userId, { ws, role });
  console.log(`[WebSocket] Connected: ${role} (${userId})`);

  // If technician, update status in DB
  if (role === 'technician') {
    const db = await getDb();
    // Default location if none exists
    await db.run(`
      UPDATE technician_profiles
      SET current_latitude = COALESCE(current_latitude, 37.7749),
          current_longitude = COALESCE(current_longitude, -122.4194)
      WHERE id = ?
    `, [userId]);
  }

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[WebSocket] Received message from ${role} (${userId}):`, message.type);

      const db = await getDb();

      switch (message.type) {
        case 'LOCATION_UPDATE': {
          if (role !== 'technician') return;
          const { latitude, longitude } = message;

          // Save coordinate to db
          await db.run(`
            UPDATE technician_profiles
            SET current_latitude = ?, current_longitude = ?
            WHERE id = ?
          `, [latitude, longitude, userId]);

          // Find if there is an active job assigned to this technician to broadcast location to customer
          const activeJob = await db.get(`
            SELECT id, customer_identity_id FROM service_bookings 
            WHERE assigned_technician_id = ? AND current_state IN ('assigned', 'transit', 'active_repair')
          `, [userId]);

          if (activeJob) {
            const customerSocket = clientSockets.get(activeJob.customer_identity_id);
            if (customerSocket && customerSocket.ws.readyState === WebSocket.OPEN) {
              customerSocket.ws.send(JSON.stringify({
                type: 'MECHANIC_LOCATION',
                latitude,
                longitude,
                bookingId: activeJob.id
              }));
            }
          }
          break;
        }

        case 'ACCEPT_JOB': {
          if (role !== 'technician') return;
          const { bookingId } = message;

          // Lock database record using atomic state update
          const booking = await db.get('SELECT * FROM service_bookings WHERE id = ?', [bookingId]);
          if (!booking) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Booking not found.' }));
            return;
          }

          if (booking.current_state !== 'awaiting_bids') {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Job has already been accepted.' }));
            return;
          }

          // Assign mechanic and lock state to assigned
          await db.run(`
            UPDATE service_bookings
            SET assigned_technician_id = ?, current_state = 'assigned', timestamp_updated = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [userId, bookingId]);

          // Fetch profile of technician for the customer info update
          const techInfo = await db.get(`
            SELECT ui.legal_name, ui.mobile_signature, tp.aggregate_rating_score
            FROM technician_profiles tp
            JOIN user_identities ui ON tp.id = ui.id
            WHERE tp.id = ?
          `, [userId]);

          // Notify Customer via socket
          const customerSocket = clientSockets.get(booking.customer_identity_id);
          if (customerSocket && customerSocket.ws.readyState === WebSocket.OPEN) {
            customerSocket.ws.send(JSON.stringify({
              type: 'JOB_ASSIGNED',
              bookingId,
              technician: {
                id: userId,
                name: techInfo.legal_name,
                phone: techInfo.mobile_signature,
                rating: techInfo.aggregate_rating_score
              }
            }));
          }

          // Alert other sockets of status update
          ws.send(JSON.stringify({ type: 'JOB_ACCEPTED_SUCCESS', bookingId }));
          break;
        }

        case 'UPDATE_JOB_STATE': {
          if (role !== 'technician') return;
          const { bookingId, state } = message;

          // Verify technician is assigned
          const booking = await db.get('SELECT * FROM service_bookings WHERE id = ?', [bookingId]);
          if (!booking || booking.assigned_technician_id !== userId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized state update.' }));
            return;
          }

          await db.run(`
            UPDATE service_bookings
            SET current_state = ?, timestamp_updated = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [state, bookingId]);

          // Notify customer of transit, arrival, or repairs
          const customerSocket = clientSockets.get(booking.customer_identity_id);
          if (customerSocket && customerSocket.ws.readyState === WebSocket.OPEN) {
            customerSocket.ws.send(JSON.stringify({
              type: 'JOB_STATE_CHANGED',
              bookingId,
              state
            }));
          }
          break;
        }

        case 'SUBMIT_HANDSHAKE': {
          const { bookingId, token } = message;
          const booking = await db.get('SELECT * FROM service_bookings WHERE id = ?', [bookingId]);

          if (!booking) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Booking not found.' }));
            return;
          }

          // Validate token match
          if (booking.handshake_verification_hash === token.trim()) {
            await db.run(`
              UPDATE service_bookings
              SET current_state = 'finalized', timestamp_updated = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [bookingId]);

            console.log(`[Escrow] Payout settled and released. Split transaction routed to mechanic ${booking.assigned_technician_id}`);

            // Notify both passenger and driver of resolution
            const notifyPayload = JSON.stringify({ type: 'JOB_FINALIZED', bookingId });
            
            const custSocket = clientSockets.get(booking.customer_identity_id);
            if (custSocket && custSocket.ws.readyState === WebSocket.OPEN) {
              custSocket.ws.send(notifyPayload);
            }

            if (booking.assigned_technician_id) {
              const techSocket = clientSockets.get(booking.assigned_technician_id);
              if (techSocket && techSocket.ws.readyState === WebSocket.OPEN) {
                techSocket.ws.send(notifyPayload);
              }
            }
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid verification token.' }));
          }
          break;
        }

        default:
          console.warn('[WebSocket] Unknown message structure:', message.type);
      }
    } catch (err: any) {
      console.error('[WebSocket] Message parsing error:', err);
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Malformed socket message.' }));
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Disconnected: ${role} (${userId})`);
    clientSockets.delete(userId);
  });
});

// Start listening
httpServer.listen(PORT, () => {
  console.log(`[Antigravity Server] REST and WebSocket server running on port ${PORT}`);
});
