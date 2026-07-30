"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Star, Navigation, CheckCircle2, Loader2, MapPin, DollarSign, AlertTriangle, Wrench, Wifi, WifiOff } from 'lucide-react';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

const JOB_STATE_CONFIG: Record<string, { label: string; color: string; glow: string }> = {
  idle:         { label: 'STANDBY',       color: '#9CA3AF', glow: 'rgba(156,163,175,0.2)' },
  assigned:     { label: 'JOB ACQUIRED',  color: '#0066FF', glow: 'rgba(0,102,255,0.2)'   },
  transit:      { label: 'EN ROUTE',      color: '#8B5CF6', glow: 'rgba(139,92,246,0.2)'  },
  active_repair:{ label: 'REPAIR ACTIVE', color: '#10B981', glow: 'rgba(16,185,129,0.2)'  },
  finalized:    { label: 'SETTLED',       color: '#10B981', glow: 'rgba(16,185,129,0.2)'  },
};

export default function MechanicDashboard() {
  const techId = 't7b417e0-47b2-4dbe-a1c1-1e96996614a2';
  const [isOnline, setIsOnline] = useState(false);
  const [techCoords, setTechCoords] = useState<[number, number]>([37.7829, -122.4044]);
  const [jobOffer, setJobOffer] = useState<any>(null);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [jobState, setJobState] = useState<string>('idle');
  const [verificationToken, setVerificationToken] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [driveProgress, setDriveProgress] = useState(0);
  const [isDriving, setIsDriving] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const driveRef = useRef<NodeJS.Timeout | null>(null);

  const stateConfig = JOB_STATE_CONFIG[jobState] || JOB_STATE_CONFIG.idle;

  const stopDrive = () => {
    if (driveRef.current) { clearInterval(driveRef.current); driveRef.current = null; }
    setIsDriving(false);
  };

  useEffect(() => {
    if (!isOnline) { wsRef.current?.close(); wsRef.current = null; stopDrive(); return; }

    const socket = new WebSocket(`ws://localhost:3001/ws/dispatch?userId=${techId}&role=technician`);
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'LOCATION_UPDATE', latitude: techCoords[0], longitude: techCoords[1] }));
    };

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'NEW_DISPATCH_REQUEST':
          if (jobState === 'idle') setJobOffer(msg.booking); break;
        case 'JOB_ACCEPTED_SUCCESS':
          setJobOffer(null); setJobState('assigned'); fetchJob(msg.bookingId); break;
        case 'JOB_FINALIZED':
          setJobState('finalized'); stopDrive(); break;
        case 'ERROR':
          alert(`Server error: ${msg.message}`); break;
      }
    };

    socket.onclose = () => setIsOnline(false);
    return () => { socket.close(); stopDrive(); };
  }, [isOnline]);

  const fetchJob = async (id: string) => {
    const r = await fetch(`http://localhost:3001/api/v1/bookings/${id}`);
    if (r.ok) setActiveJob(await r.json());
  };

  const publishLoc = (lat: number, lng: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type: 'LOCATION_UPDATE', latitude: lat, longitude: lng }));
  };

  const handleAccept = () => {
    if (!jobOffer || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'ACCEPT_JOB', bookingId: jobOffer.id }));
  };

  const handleStateUpdate = (state: 'transit' | 'active_repair') => {
    if (!activeJob || wsRef.current?.readyState !== WebSocket.OPEN) return;
    setJobState(state);
    wsRef.current.send(JSON.stringify({ type: 'UPDATE_JOB_STATE', bookingId: activeJob.id, state }));
  };

  const startDrive = () => {
    if (!activeJob) return;
    stopDrive();
    setIsDriving(true);
    setDriveProgress(0);
    handleStateUpdate('transit');

    const steps = 10;
    let step = 0;
    const sLat = techCoords[0], sLng = techCoords[1];
    const eLat = activeJob.origin_latitude, eLng = activeJob.origin_longitude;

    driveRef.current = setInterval(() => {
      step++;
      const r = step / steps;
      const nLat = sLat + (eLat - sLat) * r;
      const nLng = sLng + (eLng - sLng) * r;
      setTechCoords([nLat, nLng]);
      publishLoc(nLat, nLng);
      setDriveProgress(Math.round(r * 100));
      if (step >= steps) { stopDrive(); handleStateUpdate('active_repair'); }
    }, 300);
  };

  const handleVerify = () => {
    if (!activeJob || verificationToken.length !== 6 || wsRef.current?.readyState !== WebSocket.OPEN) return;
    setIsFinalizing(true);
    wsRef.current.send(JSON.stringify({ type: 'SUBMIT_HANDSHAKE', bookingId: activeJob.id, token: verificationToken }));
    setTimeout(() => setIsFinalizing(false), 800);
  };

  const moveTech = (dLat: number, dLng: number) => {
    const n: [number, number] = [techCoords[0] + dLat, techCoords[1] + dLng];
    setTechCoords(n); publishLoc(n[0], n[1]);
  };

  const fmt = (c: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);

  return (
    <div className="scanline-overlay min-h-screen flex flex-col" style={{ background: 'var(--bg-void)' }}>

      {/* ─── TOP HEADER ─── */}
      <header className="glass border-b sticky top-0 z-30 px-5 md:px-8 py-3.5 flex items-center gap-4"
        style={{ borderColor: 'var(--border-dim)' }}>
        <Link href="/"
          className="p-2 rounded-lg border transition-all duration-200 hover:border-[var(--blue)] hover:shadow-[var(--glow-blue-sm)]"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: '#9CA3AF' }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-2 font-mono text-xs text-[#9CA3AF]">
          <span style={{ color: 'var(--blue)' }}>SnapFix</span>
          <span>/</span>
          <span className="text-white font-bold">FIELD SPECIALIST CONSOLE</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Job state badge */}
          {jobState !== 'idle' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-[10px] font-bold transition-all duration-500"
              style={{
                background: `${stateConfig.glow}`,
                borderColor: stateConfig.color,
                color: stateConfig.color,
                boxShadow: `0 0 16px ${stateConfig.glow}`
              }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: stateConfig.color }} />
              {stateConfig.label}
            </div>
          )}

          {/* Online Toggle */}
          <button onClick={() => setIsOnline(o => !o)}
            className="flex items-center gap-2.5 px-4 py-2 rounded-xl border font-mono text-xs font-bold transition-all duration-300"
            style={{
              background: isOnline ? 'var(--green-muted)' : 'var(--bg-elevated)',
              borderColor: isOnline ? 'var(--border-green)' : 'var(--border-mid)',
              color: isOnline ? 'var(--green)' : '#9CA3AF',
              boxShadow: isOnline ? 'var(--glow-green)' : 'none'
            }}>
            {isOnline
              ? <><span className="w-2 h-2 rounded-full glow-ring-green" style={{ background: 'var(--green)' }} /><Wifi className="w-3.5 h-3.5" /> ONLINE</>
              : <><WifiOff className="w-3.5 h-3.5" /> GO ONLINE</>}
          </button>
        </div>
      </header>

      {/* ─── MAIN GRID ─── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 md:p-6">

        {/* ── LEFT PANEL ── */}
        <section className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-80px)] pr-1"
          style={{ scrollbarWidth: 'thin' }}>

          {/* Technician Profile Card */}
          <div className="glass rounded-xl border overflow-hidden animate-fade-up"
            style={{ borderColor: 'var(--border-dim)' }}>
            <div className="flex items-center gap-4 p-4 border-b" style={{ borderColor: 'var(--border-dim)' }}>
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-base"
                  style={{ background: 'linear-gradient(135deg, var(--blue), var(--blue-dim))', boxShadow: 'var(--glow-blue)' }}>
                  M
                </div>
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0"
                  style={{
                    background: isOnline ? 'var(--green)' : '#374151',
                    borderColor: 'var(--bg-void)',
                    boxShadow: isOnline ? 'var(--glow-green-sm)' : 'none'
                  }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">Marcus Vane</div>
                <div className="flex items-center gap-1.5 text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  4.95 · Hybrid Powertrain Specialist
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[9px] font-mono" style={{ color: 'var(--muted-foreground)' }}>STATUS</div>
                <div className="text-[10px] font-bold mt-0.5" style={{ color: isOnline ? 'var(--green)' : '#9CA3AF' }}>
                  {isOnline ? '● BROADCASTING' : '○ OFFLINE'}
                </div>
              </div>
            </div>

            {/* Specialization chips */}
            <div className="flex flex-wrap gap-1.5 px-4 py-3">
              {['Hybrid Powertrain', 'Braking Systems', 'Diagnostics'].map(s => (
                <span key={s} className="text-[9px] font-mono px-2 py-0.5 rounded border"
                  style={{ background: 'var(--blue-muted)', borderColor: 'var(--border-blue)', color: 'var(--blue)' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* ── OFFLINE STATE ── */}
          {!isOnline && (
            <div className="rounded-xl border p-10 text-center animate-fade-up-d1"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-mid)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}>
                <WifiOff className="w-6 h-6" style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <div className="text-sm font-bold text-white mb-1.5">Mobile Unit Offline</div>
              <p className="text-[11px] max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                Click <span className="text-white font-bold">GO ONLINE</span> to register in the spatial dispatch grid and begin receiving job notifications.
              </p>
            </div>
          )}

          {/* ── ONLINE IDLE: Scanning ── */}
          {isOnline && !jobOffer && jobState === 'idle' && (
            <div className="rounded-xl border p-8 text-center animate-scale-in"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-blue)', boxShadow: '0 0 30px rgba(0,102,255,0.07)' }}>
              <div className="relative w-20 h-20 mx-auto mb-5">
                {/* Outer ring */}
                <div className="absolute inset-0 rounded-full border" style={{ borderColor: 'rgba(0,102,255,0.15)' }} />
                <div className="absolute inset-2 rounded-full border" style={{ borderColor: 'rgba(0,102,255,0.25)' }} />
                <div className="absolute inset-4 rounded-full border" style={{ borderColor: 'rgba(0,102,255,0.4)' }} />
                {/* Sweep */}
                <div className="absolute inset-0 rounded-full"
                  style={{
                    background: 'conic-gradient(from 0deg, rgba(0,102,255,0.4), transparent 70%)',
                    animation: 'radar-spin 2.5s linear infinite'
                  }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full"
                    style={{ background: 'var(--blue)', boxShadow: 'var(--glow-blue-sm)' }} />
                </div>
                {/* Blip dots */}
                <div className="absolute w-2 h-2 rounded-full top-3 right-5"
                  style={{ background: 'var(--green)', boxShadow: 'var(--glow-green-sm)', animation: 'pulse 2.2s infinite' }} />
                <div className="absolute w-1.5 h-1.5 rounded-full bottom-5 left-3"
                  style={{ background: 'var(--blue)', animation: 'pulse 1.6s infinite 0.4s' }} />
              </div>
              <div className="text-sm font-bold text-white terminal-cursor">Monitoring dispatch grid</div>
              <div className="text-[11px] mt-1.5 max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                Spatial node registered. Awaiting emergency dispatch within your sector.
              </div>
              <div className="mt-4 flex items-center justify-center gap-1.5 text-[9px] font-mono" style={{ color: 'var(--green)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--green)' }} />
                COORD STREAM ACTIVE · {techCoords[0].toFixed(4)}, {techCoords[1].toFixed(4)}
              </div>
            </div>
          )}

          {/* ── JOB OFFER ALERT ── */}
          {isOnline && jobOffer && jobState === 'idle' && (
            <div className="rounded-xl border overflow-hidden animate-scale-in"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-red)',
                boxShadow: 'var(--glow-red)'
              }}>
              {/* Urgent header */}
              <div className="flex items-center gap-2.5 px-5 py-3 border-b"
                style={{ background: 'var(--red-muted)', borderColor: 'var(--border-red)' }}>
                <AlertTriangle className="w-4 h-4 animate-pulse" style={{ color: 'var(--red)' }} />
                <span className="text-xs font-black text-white tracking-wider">EMERGENCY DISPATCH REQUEST</span>
                <span className="ml-auto text-[9px] font-mono" style={{ color: '#9CA3AF' }}>
                  {jobOffer.id?.slice(0, 8)}
                </span>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {/* Payout Row */}
                <div className="flex items-center justify-between p-4 rounded-xl border"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-green)', boxShadow: '0 0 20px rgba(16,185,129,0.06)' }}>
                  <div>
                    <div className="text-[9px] font-mono mb-0.5" style={{ color: 'var(--muted-foreground)' }}>GUARANTEED ESCROW PAYOUT</div>
                    <div className="text-2xl font-black text-white">{fmt(jobOffer.escrow_held_price_cents)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-[9px] font-mono" style={{ color: 'var(--muted-foreground)' }}>SECTOR DISTANCE</div>
                    <div className="text-sm font-bold" style={{ color: 'var(--green)' }}>~1.8 km</div>
                    <div className="text-[9px] font-mono" style={{ color: 'var(--muted-foreground)' }}>~4 min ETA</div>
                  </div>
                </div>

                {/* AI Diagnostic Brief */}
                {jobOffer.ai_analysis_summary_json && (
                  <div className="rounded-xl border p-4"
                    style={{ background: 'var(--bg-raised)', borderColor: 'var(--border-dim)' }}>
                    <div className="text-[9px] font-mono mb-2.5" style={{ color: 'var(--muted-foreground)' }}>AI DIAGNOSTIC BRIEF</div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black font-mono text-white">
                        {jobOffer.ai_analysis_summary_json.fault_code}
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded border uppercase"
                        style={{
                          background: 'var(--red-muted)', borderColor: 'var(--border-red)', color: 'var(--red)'
                        }}>
                        {jobOffer.ai_analysis_summary_json.severity}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed line-clamp-3" style={{ color: 'var(--muted-foreground)' }}>
                      {jobOffer.ai_analysis_summary_json.description}
                    </p>
                    <div className="mt-2.5 text-[10px] font-mono" style={{ color: '#9CA3AF' }}>
                      Confidence: {((jobOffer.ai_analysis_summary_json.confidence || 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                )}

                {/* Accept / Dismiss */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button onClick={() => setJobOffer(null)}
                    className="py-2.5 rounded-xl text-xs font-bold border transition-all duration-200"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: '#9CA3AF' }}>
                    Dismiss
                  </button>
                  <button onClick={handleAccept}
                    className="py-2.5 rounded-xl text-xs font-black text-white transition-all duration-200"
                    style={{
                      background: 'linear-gradient(135deg, var(--blue), var(--blue-dim))',
                      border: '1px solid var(--border-blue)',
                      boxShadow: 'var(--glow-blue)'
                    }}>
                    Accept Dispatch →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── ACTIVE JOB CONSOLE ── */}
          {jobState !== 'idle' && activeJob && (
            <div className="rounded-xl border overflow-hidden animate-scale-in"
              style={{
                background: 'var(--bg-card)',
                borderColor: stateConfig.color + '60',
                boxShadow: `0 0 30px ${stateConfig.glow}`
              }}>
              {/* Panel Header */}
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b"
                style={{ borderColor: 'var(--border-dim)', background: 'var(--bg-elevated)' }}>
                <Wrench className="w-4 h-4" style={{ color: stateConfig.color }} />
                <span className="text-xs font-bold text-white">SERVICE EXECUTION CONSOLE</span>
                <span className="ml-auto text-[9px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
                  CLIENT: {activeJob.customer_name}
                </span>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {/* Escrow lock */}
                <div className="flex items-center justify-between p-4 rounded-xl border"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-green)' }}>
                  <div>
                    <div className="text-[9px] font-mono mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      PRE-AUTHORIZED ESCROW CAPTURE
                    </div>
                    <div className="text-xl font-black text-white">{fmt(activeJob.escrow_held_price_cents)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-lg border"
                    style={{ background: 'var(--green-muted)', borderColor: 'var(--border-green)', color: 'var(--green)' }}>
                    <DollarSign className="w-3.5 h-3.5" /> LOCKED
                  </div>
                </div>

                {/* Service Plan */}
                <div className="rounded-xl border p-4"
                  style={{ background: 'var(--bg-raised)', borderColor: 'var(--border-dim)' }}>
                  <div className="text-[9px] font-mono mb-1" style={{ color: 'var(--muted-foreground)' }}>FAULT CODE</div>
                  <div className="text-sm font-black font-mono text-white mb-2">
                    {activeJob.ai_analysis_summary_json?.fault_code}
                  </div>
                  <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--muted-foreground)' }}>
                    {activeJob.ai_analysis_summary_json?.description}
                  </p>

                  <div className="border-t pt-3" style={{ borderColor: 'var(--border-dim)' }}>
                    <div className="text-[9px] font-mono mb-2" style={{ color: 'var(--muted-foreground)' }}>REQUIRED OPERATIONS</div>
                    <div className="space-y-1.5">
                      {activeJob.ai_analysis_summary_json?.recommended_actions?.map((a: string, i: number) => (
                        <label key={i} className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" className="mt-0.5 accent-[var(--blue)] flex-shrink-0" />
                          <span className="text-[11px]" style={{ color: '#D1D5DB' }}>{a}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Transit Button + Progress */}
                {jobState === 'assigned' && (
                  <button onClick={startDrive}
                    className="w-full py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: 'linear-gradient(135deg, var(--blue), var(--blue-dim))',
                      border: '1px solid var(--border-blue)',
                      boxShadow: 'var(--glow-blue)'
                    }}>
                    <Navigation className="w-4 h-4" style={{ animation: 'pulse 1s infinite' }} />
                    Initiate Auto-Drive Simulation
                  </button>
                )}

                {/* Drive Progress Bar */}
                {jobState === 'transit' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span style={{ color: 'var(--muted-foreground)' }}>ROUTE PROGRESS</span>
                      <span style={{ color: '#8B5CF6' }}>{driveProgress}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${driveProgress}%`,
                          background: 'linear-gradient(90deg, var(--blue), #8B5CF6)',
                          boxShadow: '0 0 10px rgba(139,92,246,0.6)'
                        }} />
                    </div>
                    <button onClick={() => handleStateUpdate('active_repair')}
                      className="w-full py-2.5 rounded-xl text-xs font-bold border text-white transition-all"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'rgba(139,92,246,0.4)', color: '#8B5CF6' }}>
                      Skip · Mark Arrived at Site
                    </button>
                  </div>
                )}

                {/* OTP Verification Panel */}
                {jobState === 'active_repair' && (
                  <div className="rounded-xl border p-4"
                    style={{ background: 'var(--green-muted)', borderColor: 'var(--border-green)', boxShadow: '0 0 20px rgba(16,185,129,0.06)' }}>
                    <div className="text-[9px] font-mono mb-1" style={{ color: 'var(--green)' }}>ESCROW RELEASE HANDSHAKE</div>
                    <p className="text-[11px] mb-3 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                      Enter the 6-digit token shown on the commuter's device to confirm repair and release payout.
                    </p>
                    <div className="flex gap-2">
                      <input type="text" maxLength={6} value={verificationToken}
                        onChange={e => setVerificationToken(e.target.value.replace(/\D/g, ''))}
                        placeholder="______"
                        className="flex-1 text-center py-2.5 rounded-lg text-xl font-black tracking-[0.4em] font-mono outline-none transition-all"
                        style={{
                          background: 'var(--bg-raised)', border: '1px solid var(--border-green)',
                          color: 'var(--green)', caretColor: 'var(--green)'
                        }} />
                      <button onClick={handleVerify}
                        disabled={isFinalizing || verificationToken.length !== 6}
                        className="px-4 rounded-lg text-xs font-black text-white transition-all"
                        style={{
                          background: verificationToken.length === 6
                            ? 'linear-gradient(135deg, var(--green), var(--green-dim))'
                            : 'var(--bg-elevated)',
                          border: `1px solid ${verificationToken.length === 6 ? 'var(--border-green)' : 'var(--border-mid)'}`,
                          boxShadow: verificationToken.length === 6 ? 'var(--glow-green)' : 'none',
                          color: verificationToken.length === 6 ? '#fff' : '#9CA3AF'
                        }}>
                        {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'VERIFY'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Finalized */}
                {jobState === 'finalized' && (
                  <div className="rounded-xl border p-8 text-center animate-scale-in"
                    style={{ background: 'var(--green-muted)', borderColor: 'var(--border-green)', boxShadow: 'var(--glow-green)' }}>
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--green)' }} />
                    <div className="text-sm font-bold text-white mb-1">PAYOUT RELEASED</div>
                    <div className="text-[11px] max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                      Token verified. Stripe split transaction settled to your mobile specialist profile.
                    </div>
                    <button onClick={() => { setJobState('idle'); setActiveJob(null); setVerificationToken(''); setDriveProgress(0); }}
                      className="mt-5 px-6 py-2.5 rounded-lg text-xs font-bold border text-white transition-all"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}>
                      Return to Duty
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MANUAL DRIVING CONTROLS ── */}
          {isOnline && jobState !== 'finalized' && (
            <div className="rounded-xl border p-4 animate-fade-up-d3"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-dim)' }}>
              <div className="text-[9px] font-mono mb-3" style={{ color: 'var(--muted-foreground)' }}>
                MANUAL COORDINATE OVERRIDE · SIMULATION CONTROLS
              </div>
              <div className="grid grid-cols-3 gap-1.5 max-w-[160px] mx-auto">
                <div />
                <button onClick={() => moveTech(0.001, 0)} className="py-2 rounded-lg text-[10px] font-mono font-bold border text-white transition-all hover:border-[var(--blue)] hover:shadow-[var(--glow-blue-sm)]"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}>▲ N</button>
                <div />
                <button onClick={() => moveTech(0, -0.001)} className="py-2 rounded-lg text-[10px] font-mono font-bold border text-white transition-all hover:border-[var(--blue)] hover:shadow-[var(--glow-blue-sm)]"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}>◀ W</button>
                <div className="flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--blue)', boxShadow: 'var(--glow-blue-sm)' }} />
                </div>
                <button onClick={() => moveTech(0, 0.001)} className="py-2 rounded-lg text-[10px] font-mono font-bold border text-white transition-all hover:border-[var(--blue)] hover:shadow-[var(--glow-blue-sm)]"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}>E ▶</button>
                <div />
                <button onClick={() => moveTech(-0.001, 0)} className="py-2 rounded-lg text-[10px] font-mono font-bold border text-white transition-all hover:border-[var(--blue)] hover:shadow-[var(--glow-blue-sm)]"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}>▼ S</button>
                <div />
              </div>
              <div className="mt-3 text-center text-[9px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
                {techCoords[0].toFixed(5)}° N · {Math.abs(techCoords[1]).toFixed(5)}° W
              </div>
            </div>
          )}
        </section>

        {/* ── RIGHT MAP PANEL ── */}
        <section className="lg:col-span-7 flex flex-col gap-4 min-h-[480px]">
          <div className="glass rounded-xl border px-4 py-2.5 flex items-center justify-between"
            style={{ borderColor: 'var(--border-dim)' }}>
            <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
              <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--blue)' }} />
              SPATIAL ROUTING SUBSYSTEM · FIELD UNIT TELEMETRY
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-mono"
              style={{ color: isOnline ? 'var(--green)' : 'var(--muted-foreground)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: isOnline ? 'var(--green)' : '#374151', boxShadow: isOnline ? 'var(--glow-green-sm)' : 'none' }} />
              {isOnline ? 'NODE ACTIVE' : 'NODE OFFLINE'}
            </div>
          </div>

          <div className="flex-1 relative rounded-xl border overflow-hidden min-h-[400px]"
            style={{
              borderColor: 'var(--border-dim)',
              boxShadow: isOnline ? 'var(--glow-blue)' : 'none',
              transition: 'box-shadow 0.5s'
            }}>
            <Map
              customerLoc={activeJob ? [activeJob.origin_latitude, activeJob.origin_longitude] : null}
              mechanicLoc={techCoords}
              state={jobState}
            />

            {/* HUD Overlay */}
            <div className="absolute top-3 left-3 z-[1000] rounded-xl border p-3.5 animate-fade-up"
              style={{ background: 'var(--glass-thick)', backdropFilter: 'blur(20px)', borderColor: 'var(--border-dim)' }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--blue)', boxShadow: isOnline ? 'var(--glow-blue-sm)' : 'none' }} />
                <span className="text-[10px] font-bold text-white">Marcus Vane</span>
              </div>
              <div className="text-[9px] font-mono mt-1" style={{ color: 'var(--muted-foreground)' }}>
                {techCoords[0].toFixed(4)}° N · {Math.abs(techCoords[1]).toFixed(4)}° W
              </div>
              <div className="mt-1.5 text-[9px] font-mono"
                style={{ color: isOnline ? 'var(--green)' : '#9CA3AF' }}>
                {isOnline ? '● BROADCASTING' : '○ OFFLINE'}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
