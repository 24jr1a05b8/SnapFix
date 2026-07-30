# SnapFix 🔧

> AI-driven on-demand vehicle maintenance and roadside dispatch platform.

SnapFix connects stranded commuters with nearby field specialists in real-time — powered by Gemini AI diagnostics, WebSocket dispatch, Leaflet mapping, and Stripe escrow payments.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI Diagnostics** | Gemini 1.5 Flash analyzes vehicle symptoms (text + image) and returns a fault code, severity, confidence score, and cost estimate |
| 📡 **Real-time Dispatch** | WebSocket server broadcasts job offers to nearby technicians and streams live GPS coordinates back to the commuter |
| 🗺️ **Live Map Tracking** | Leaflet/OpenStreetMap renders both the commuter's location and the technician's route in real-time |
| 💰 **Escrow Payments** | Stripe mock escrow holds funds at booking; a 6-digit OTP handshake token releases the payout on repair completion |
| 📍 **Spatial Matching** | Haversine-formula spatial search finds technicians within a 15 km dispatch radius |
| 🔄 **Job State Machine** | Full lifecycle: `awaiting_bids → assigned → transit → active_repair → finalized` |

---

## 🏗️ Architecture

```
┌─────────────────────┐        REST + WebSocket        ┌──────────────────────┐
│   Next.js 16 Client │ ◄────────────────────────────► │  Express + WS Server │
│   (localhost:3000)  │                                 │   (localhost:3001)   │
└─────────────────────┘                                 └──────────┬───────────┘
         │                                                         │
         │  Leaflet / OSM                              ┌───────────▼───────────┐
         │  Map Rendering                              │    SQLite Database     │
         │                                             │  (user_identities,    │
         ▼                                             │   technician_profiles,│
   Browser Client                                      │   service_bookings)   │
                                                       └───────────┬───────────┘
                                                                   │
                                                       ┌───────────▼───────────┐
                                                       │   Google Gemini AI    │
                                                       │  (Vehicle Diagnostics)│
                                                       └───────────────────────┘
```

---

## 📁 Project Structure

```
SnapFix/
├── client/                   # Next.js 16 frontend
│   └── src/
│       ├── app/
│       │   ├── page.tsx          # Landing page (portal selector)
│       │   ├── customer/
│       │   │   └── page.tsx      # Commuter dispatch console
│       │   └── mechanic/
│       │       └── page.tsx      # Field specialist console
│       ├── components/
│       │   └── Map.tsx           # Leaflet map component
│       └── app/globals.css       # Design system tokens
│
├── server/                   # Express + WebSocket backend
│   └── src/
│       ├── index.ts              # REST API + WebSocket handler
│       ├── db.ts                 # SQLite connection & schema init
│       ├── ai.ts                 # Gemini AI diagnostic integration
│       ├── spatial.ts            # Haversine spatial search
│       └── types.ts              # Shared TypeScript types
│
├── schema.sql                # Database schema reference
├── package.json              # Monorepo workspace config
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v20+
- **npm** v9+
- A **Google Gemini API key** (for AI diagnostics)

### 1. Clone the repo

```bash
git clone https://github.com/24jr1a05b8/SnapFix.git
cd SnapFix
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file inside the `server/` directory:

```env
GEMINI_API_KEY=your_google_gemini_api_key_here
PORT=3001
```

### 4. Run the development servers

```bash
npm run dev
```

This starts both services concurrently:

| Service | URL |
|---|---|
| **Frontend** (Next.js) | http://localhost:3000 |
| **Backend** (Express + WS) | http://localhost:3001 |

---

## 🖥️ Usage

### Commuter Portal (`/customer`)
1. Select a symptom preset or type a custom description
2. Optionally attach a photo of the issue
3. Click **Analyze Vehicle Telemetry** — Gemini AI returns a diagnosis
4. Review the fault code, severity, cost estimate, and recommended actions
5. Click **Lock Escrow & Dispatch Unit** to broadcast to nearby technicians
6. Track the technician's live position on the map
7. Share the **6-digit OTP token** with the technician after repair to release payment

### Technician Portal (`/mechanic`)
1. Click **GO ONLINE** to register in the dispatch grid
2. Wait for an emergency dispatch notification to appear
3. Review the AI diagnostic brief and guaranteed payout
4. Click **Accept Dispatch →** to claim the job
5. Use **Initiate Auto-Drive Simulation** or manual controls to navigate
6. Enter the customer's OTP token to finalize and receive payout

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Server health check |
| `POST` | `/api/v1/diagnostics` | Submit symptoms for AI analysis |
| `POST` | `/api/v1/bookings` | Create booking + lock escrow |
| `GET` | `/api/v1/bookings/:id` | Fetch booking details |
| `GET` | `/api/v1/technicians` | List all technician profiles |
| `WS` | `/ws/dispatch` | Real-time dispatch WebSocket |

### WebSocket Message Types

| Type | Direction | Description |
|---|---|---|
| `LOCATION_UPDATE` | Technician → Server | Broadcasts current GPS coords |
| `NEW_DISPATCH_REQUEST` | Server → Technician | New job offer alert |
| `ACCEPT_JOB` | Technician → Server | Claim a job |
| `JOB_ACCEPTED_SUCCESS` | Server → Technician | Confirmation of acceptance |
| `JOB_ASSIGNED` | Server → Customer | Technician details |
| `UPDATE_JOB_STATE` | Technician → Server | State transition |
| `JOB_STATE_CHANGED` | Server → Customer | State update relay |
| `MECHANIC_LOCATION` | Server → Customer | Live technician coordinates |
| `SUBMIT_HANDSHAKE` | Technician → Server | OTP token submission |
| `JOB_FINALIZED` | Server → Both | Escrow released, job closed |

---

## 🛠️ Tech Stack

**Frontend**
- [Next.js 16](https://nextjs.org/) with Turbopack
- [React 19](https://react.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Leaflet](https://leafletjs.com/) + OpenStreetMap
- [Lucide React](https://lucide.dev/) icons

**Backend**
- [Express.js](https://expressjs.com/)
- [ws](https://github.com/websockets/ws) — WebSocket server
- [SQLite](https://www.sqlite.org/) via `sqlite` + `sqlite3`
- [Google Gemini AI](https://ai.google.dev/) — `gemini-1.5-flash`
- [tsx](https://github.com/privatenumber/tsx) — TypeScript execution

---

## 📜 License

MIT © 2026 SnapFix
