"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Shield, Sparkles, Loader2, Camera, CheckCircle2, Star, MapPin, Phone, AlertTriangle } from 'lucide-react';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
}

const PRESETS = [
  { name: "Brake Grinding", text: "My front brakes are squealing loudly whenever I slow down. It started as a whistle, now it sounds like a grinding noise at full stop.", icon: "🛑", color: "#EF4444" },
  { name: "Dead Battery", text: "Car won't start. When I turn the key, I just hear rapid clicking. Dashboard lights are very dim and flickering.", icon: "⚡", color: "#F59E0B" },
  { name: "Coolant Leak", text: "Engine temperature gauge has spiked into the red zone and steam is coming from under the radiator cap. Green puddle under front bumper.", icon: "🔥", color: "#0066FF" },
];

const JOB_STATE_CONFIG: Record<string, { label: string; color: string; glow: string }> = {
  idle:          { label: 'STANDBY',        color: '#9CA3AF', glow: 'rgba(156,163,175,0.2)' },
  awaiting_bids: { label: 'SCANNING GRID',  color: '#F59E0B', glow: 'rgba(245,158,11,0.2)' },
  assigned:      { label: 'UNIT ASSIGNED',  color: '#0066FF', glow: 'rgba(0,102,255,0.2)' },
  transit:       { label: 'EN ROUTE',       color: '#8B5CF6', glow: 'rgba(139,92,246,0.2)' },
  active_repair: { label: 'REPAIR ACTIVE',  color: '#10B981', glow: 'rgba(16,185,129,0.2)' },
  finalized:     { label: 'RESOLVED',       color: '#10B981', glow: 'rgba(16,185,129,0.2)' },
};

export default function CustomerDashboard() {
  const [customerCoords] = useState<[number, number]>([37.7749, -122.4194]);
  const [symptomsText, setSymptomsText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiReport, setAiReport] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEscrowLocking, setIsEscrowLocking] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [handshakeToken, setHandshakeToken] = useState<string | null>(null);
  const [bookingState, setBookingState] = useState<string>('idle');
  const [assignedTech, setAssignedTech] = useState<any>(null);
  const [mechanicCoords, setMechanicCoords] = useState<[number, number] | null>(null);
  const [etaText, setEtaText] = useState('Calculating...');
  const [tick, setTick] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Live clock tick
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (bookingState === 'idle' || bookingState === 'finalized') {
      wsRef.current?.close(); wsRef.current = null; return;
    }
    const customerId = 'c8b417e0-47b2-4dbe-a1c1-1e96996614a1';
    const socket = new WebSocket(`ws://localhost:3001/ws/dispatch?userId=${customerId}&role=customer`);
    wsRef.current = socket;

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'JOB_ASSIGNED':
          setBookingState('assigned'); setAssignedTech(msg.technician);
          setMechanicCoords([customerCoords[0] + 0.008, customerCoords[1] + 0.015]); setEtaText('12 minutes'); break;
        case 'JOB_STATE_CHANGED':
          setBookingState(msg.state);
          if (msg.state === 'transit') setEtaText('En Route (8 mins)');
          else if (msg.state === 'active_repair') setEtaText('Arrived — Repair Initiated'); break;
        case 'MECHANIC_LOCATION':
          setMechanicCoords([msg.latitude, msg.longitude]);
          const d = Math.sqrt(Math.pow(msg.latitude - customerCoords[0], 2) + Math.pow(msg.longitude - customerCoords[1], 2)) * 111;
          setEtaText(d < 0.1 ? 'Arrived at Location' : `${Math.ceil(d * 3)} mins away`); break;
        case 'JOB_FINALIZED': setBookingState('finalized'); break;
      }
    };
    return () => socket.close();
  }, [bookingState, customerCoords]);

  const handleAnalyze = async () => {
    if (!symptomsText.trim()) return;
    setIsAnalyzing(true); setAiReport(null);
    try {
      let imageBase64, imageMime;
      if (selectedFile) { imageBase64 = await fileToBase64(selectedFile); imageMime = selectedFile.type; }
      const res = await fetch('http://localhost:3001/api/v1/diagnostics', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: symptomsText, imageBase64, imageMime })
      });
      if (!res.ok) throw new Error();
      setAiReport(await res.json());
    } catch { alert('Diagnostic service unreachable. Ensure backend is running.'); }
    finally { setIsAnalyzing(false); }
  };

  const handleDispatch = async () => {
    if (!aiReport) return;
    setIsEscrowLocking(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'c8b417e0-47b2-4dbe-a1c1-1e96996614a1',
          originLatitude: customerCoords[0], originLongitude: customerCoords[1],
          diagnosticSummary: aiReport, escrowAmountCents: aiReport.estimated_cost_cents_range[1]
        })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBookingId(data.bookingId); setHandshakeToken(data.handshakeToken); setBookingState('awaiting_bids');
    } catch { alert('Dispatch failed.'); }
    finally { setIsEscrowLocking(false); }
  };

  const fmt = (c: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);
  const stateConfig = JOB_STATE_CONFIG[bookingState] || JOB_STATE_CONFIG.idle;

  return (
    <div className="scanline-overlay min-h-screen flex flex-col" style={{ background: 'var(--bg-void)' }}>

      {/* ─── TOP HEADER BAR ─── */}
      <header className="glass border-b sticky top-0 z-30 px-5 md:px-8 py-3.5 flex items-center gap-4"
        style={{ borderColor: 'var(--border-dim)' }}>
        <Link href="/" className="p-2 rounded-lg border transition-all duration-200 hover:border-[var(--blue)] hover:shadow-[var(--glow-blue-sm)]"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: '#9CA3AF' }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 font-mono text-xs text-[#9CA3AF]">
          <span className="text-[var(--blue)]">SnapFix</span>
          <span>/</span>
          <span className="text-white font-bold">COMMUTER CONSOLE</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Live state badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-[10px] font-bold transition-all duration-500"
            style={{
              background: `${stateConfig.glow}`,
              borderColor: stateConfig.color,
              color: stateConfig.color,
              boxShadow: bookingState !== 'idle' ? `0 0 16px ${stateConfig.glow}` : 'none'
            }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: stateConfig.color }} />
            {stateConfig.label}
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-mono"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--green)' }}>
            <Shield className="w-3.5 h-3.5" />
            STRIPE ESCROW ACTIVE
          </div>
        </div>
      </header>

      {/* ─── MAIN GRID ─── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 md:p-6">

        {/* ── LEFT PANEL ── */}
        <section className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-80px)] pr-1"
          style={{ scrollbarWidth: 'thin' }}>

          {/* Client Identity Card */}
          <div className="glass rounded-xl border p-4 flex items-center gap-3 animate-fade-up"
            style={{ borderColor: 'var(--border-dim)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm"
              style={{ background: 'linear-gradient(135deg, var(--red), var(--red-dim))' }}>A</div>
            <div>
              <div className="text-sm font-bold text-white">Alex Carter</div>
              <div className="text-[10px] font-mono" style={{ color: 'var(--muted-foreground)' }}>IDENT: c8b417e0 · +1 555-0101</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[9px] font-mono" style={{ color: 'var(--muted-foreground)' }}>GPS LOCK</div>
              <div className="text-[10px] font-mono" style={{ color: 'var(--green)' }}>37.7749, -122.4194</div>
            </div>
          </div>

          {/* ── STEP 1: Input — show when idle ── */}
          {bookingState === 'idle' && (
            <div className="rounded-xl border overflow-hidden animate-fade-up-d1"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-mid)' }}>

              {/* Panel Header */}
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b"
                style={{ borderColor: 'var(--border-dim)', background: 'var(--bg-elevated)' }}>
                <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black"
                  style={{ background: 'var(--red-muted)', color: 'var(--red)', border: '1px solid var(--border-red)' }}>1</div>
                <span className="text-xs font-bold text-white">SYMPTOM TELEMETRY INPUT</span>
                <span className="ml-auto text-[9px] font-mono" style={{ color: 'var(--muted-foreground)' }}>FR-1.2 COMPLIANT</span>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {/* Quick Presets */}
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map((p, i) => (
                    <button key={i} onClick={() => setSymptomsText(p.text)}
                      className="group p-3 rounded-lg border text-left transition-all duration-200"
                      style={{ background: 'var(--bg-raised)', borderColor: 'var(--border-dim)' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = p.color;
                        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px ${p.color}30`;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-dim)';
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      }}>
                      <div className="text-base mb-1.5">{p.icon}</div>
                      <div className="text-[10px] font-bold text-white leading-tight">{p.name}</div>
                    </button>
                  ))}
                </div>

                {/* Textarea */}
                <div className="relative">
                  <textarea value={symptomsText} onChange={e => setSymptomsText(e.target.value)}
                    placeholder="Describe mechanical symptoms: noises, leaks, warning lights, start failures..."
                    className="w-full min-h-[110px] p-3.5 pr-4 rounded-lg text-[12px] outline-none resize-none transition-all duration-200 placeholder-[#4B5563]"
                    style={{
                      background: 'var(--bg-raised)', border: '1px solid var(--border-mid)',
                      color: '#F3F4F6', fontFamily: 'var(--font-ui)'
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-blue)'; e.currentTarget.style.boxShadow = 'var(--glow-blue-sm)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>

                {/* File Upload */}
                <label className="flex items-center gap-3 p-3.5 rounded-lg border border-dashed cursor-pointer transition-all duration-200"
                  style={{ background: 'var(--bg-raised)', borderColor: 'var(--border-mid)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-blue)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-mid)'}>
                  <Camera className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                  <div className="flex-1 min-w-0">
                    {selectedFile
                      ? <span className="text-[11px] font-mono truncate block" style={{ color: 'var(--green)' }}>📎 {selectedFile.name}</span>
                      : <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Attach telemetry image (PNG/JPEG ≤ 10MB)</span>}
                  </div>
                  {selectedFile && <button onClick={e => { e.preventDefault(); setSelectedFile(null); }} className="text-xs ml-1 px-2 py-0.5 rounded" style={{ color: 'var(--red)', background: 'var(--red-muted)' }}>✕</button>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                </label>

                {/* Analyze Button */}
                <button onClick={handleAnalyze} disabled={isAnalyzing || !symptomsText.trim()}
                  className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300"
                  style={{
                    background: isAnalyzing || !symptomsText.trim()
                      ? 'var(--bg-elevated)'
                      : 'linear-gradient(135deg, var(--blue) 0%, var(--blue-dim) 100%)',
                    color: isAnalyzing || !symptomsText.trim() ? 'var(--muted-foreground)' : '#fff',
                    boxShadow: isAnalyzing || !symptomsText.trim() ? 'none' : 'var(--glow-blue)',
                    border: `1px solid ${isAnalyzing || !symptomsText.trim() ? 'var(--border-mid)' : 'var(--border-blue)'}`
                  }}>
                  {isAnalyzing
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Querying Gemini AI Engine...</>
                    : <><Sparkles className="w-4 h-4" /> Analyze Vehicle Telemetry</>}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: AI Report Card ── */}
          {bookingState === 'idle' && aiReport && (
            <div className="rounded-xl border overflow-hidden animate-scale-in"
              style={{
                background: 'var(--bg-card)',
                borderColor: aiReport.severity === 'critical' || aiReport.severity === 'high' ? 'var(--border-red)' : 'var(--border-mid)',
                boxShadow: aiReport.severity === 'critical' || aiReport.severity === 'high' ? 'var(--glow-red)' : 'none'
              }}>

              {/* Report Header */}
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b"
                style={{ borderColor: 'var(--border-dim)', background: 'var(--bg-elevated)' }}>
                <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black"
                  style={{ background: 'var(--green-muted)', color: 'var(--green)', border: '1px solid var(--border-green)' }}>2</div>
                <span className="text-xs font-bold text-white">GEMINI DIAGNOSTIC EVALUATION</span>
                <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                  aiReport.severity === 'critical' || aiReport.severity === 'high'
                    ? 'animate-pulse'
                    : ''
                }`}
                  style={{
                    background: aiReport.severity === 'critical' || aiReport.severity === 'high' ? 'var(--red-muted)' : 'var(--bg-overlay)',
                    borderColor: aiReport.severity === 'critical' || aiReport.severity === 'high' ? 'var(--border-red)' : 'var(--border-mid)',
                    color: aiReport.severity === 'critical' || aiReport.severity === 'high' ? 'var(--red)' : 'var(--amber)'
                  }}>
                  {aiReport.severity}
                </span>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'FAULT CODE', value: aiReport.fault_code, mono: true },
                    { label: 'CONFIDENCE', value: `${(aiReport.confidence * 100).toFixed(0)}%`, mono: true },
                  ].map(m => (
                    <div key={m.label} className="p-3 rounded-lg border"
                      style={{ background: 'var(--bg-raised)', borderColor: 'var(--border-dim)' }}>
                      <div className="text-[9px] font-mono mb-1" style={{ color: 'var(--muted-foreground)' }}>{m.label}</div>
                      <div className={`text-sm font-black text-white ${m.mono ? 'font-mono' : ''}`}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Description */}
                <p className="text-[11px] leading-relaxed p-3.5 rounded-lg border"
                  style={{ background: 'var(--bg-raised)', borderColor: 'var(--border-dim)', color: 'var(--muted-foreground)' }}>
                  {aiReport.description}
                </p>

                {/* Cost Range */}
                <div className="flex items-center justify-between p-4 rounded-lg border"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-blue)', boxShadow: '0 0 20px rgba(0,102,255,0.08)' }}>
                  <div>
                    <div className="text-[9px] font-mono mb-0.5" style={{ color: 'var(--muted-foreground)' }}>ESTIMATED REPAIR RANGE</div>
                    <div className="text-xl font-black text-white">{fmt(aiReport.estimated_cost_cents_range[0])} – {fmt(aiReport.estimated_cost_cents_range[1])}</div>
                  </div>
                  <div className="text-[9px] text-right leading-tight max-w-[100px]" style={{ color: 'var(--muted-foreground)' }}>
                    Includes mobile call-out + standard parts
                  </div>
                </div>

                {/* Recommended Actions */}
                <div className="space-y-2">
                  <div className="text-[9px] font-mono" style={{ color: 'var(--muted-foreground)' }}>RECOMMENDED FIELD OPERATIONS</div>
                  {aiReport.recommended_actions.map((a: string, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 text-[11px]" style={{ color: '#D1D5DB' }}>
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--blue)' }} />
                      {a}
                    </div>
                  ))}
                </div>

                {/* Dispatch Button */}
                <button onClick={handleDispatch} disabled={isEscrowLocking}
                  className="animated-border w-full mt-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300"
                  style={{
                    background: isEscrowLocking ? 'var(--bg-elevated)' : 'linear-gradient(135deg, var(--green) 0%, var(--green-dim) 100%)',
                    color: '#fff',
                    boxShadow: isEscrowLocking ? 'none' : 'var(--glow-green)',
                    border: `1px solid ${isEscrowLocking ? 'var(--border-mid)' : 'var(--border-green)'}`
                  }}>
                  {isEscrowLocking
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Locking Stripe Escrow Hold...</>
                    : <><Shield className="w-4 h-4" /> Lock Escrow & Dispatch Unit</>}
                </button>
              </div>
            </div>
          )}

          {/* ── Active Job Tracking ── */}
          {bookingState !== 'idle' && (
            <div className="rounded-xl border overflow-hidden animate-scale-in"
              style={{ background: 'var(--bg-card)', borderColor: stateConfig.color + '60', boxShadow: `0 0 30px ${stateConfig.glow}` }}>

              {/* Job Header */}
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b"
                style={{ borderColor: 'var(--border-dim)', background: 'var(--bg-elevated)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: stateConfig.color, boxShadow: `0 0 8px ${stateConfig.color}` }} />
                  <span className="text-xs font-bold text-white">ACTIVE DISPATCH SEQUENCE</span>
                </div>
                <span className="ml-auto text-[9px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
                  {bookingId ? `ID: ${bookingId.slice(0, 8)}` : ''}
                </span>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {/* State: Scanning */}
                {bookingState === 'awaiting_bids' && (
                  <div className="text-center py-8 rounded-xl border border-dashed"
                    style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.03)' }}>
                    {/* Radar animation */}
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: 'rgba(245,158,11,0.2)' }} />
                      <div className="absolute inset-2 rounded-full border" style={{ borderColor: 'rgba(245,158,11,0.3)' }} />
                      <div className="absolute inset-0 rounded-full border border-[var(--amber)]"
                        style={{ transformOrigin: 'center', animation: 'radar-spin 2s linear infinite',
                          background: 'conic-gradient(from 0deg, rgba(245,158,11,0.3), transparent 60%)' }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--amber)', boxShadow: '0 0 8px var(--amber)' }} />
                      </div>
                    </div>
                    <div className="text-sm font-bold text-white terminal-cursor">Scanning spatial grid</div>
                    <div className="text-[11px] mt-1 max-w-xs mx-auto" style={{ color: 'var(--muted-foreground)' }}>
                      Querying active technician nodes within 15km dispatch radius
                    </div>
                  </div>
                )}

                {/* Assigned Technician Card */}
                {assignedTech && (
                  <div className="p-4 rounded-xl border flex items-center justify-between gap-3"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-blue)', boxShadow: '0 0 20px rgba(0,102,255,0.08)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-white glow-ring-blue"
                        style={{ background: 'linear-gradient(135deg, var(--blue), var(--blue-dim))', flexShrink: 0 }}>
                        {assignedTech.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{assignedTech.name}</div>
                        <div className="flex items-center gap-1.5 text-[10px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {assignedTech.rating} · Verified Field Specialist
                        </div>
                      </div>
                    </div>
                    <a href={`tel:${assignedTech.phone}`}
                      className="p-2.5 rounded-lg border transition-all duration-200 hover:border-[var(--blue)] hover:shadow-[var(--glow-blue-sm)]"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-mid)', color: '#9CA3AF' }}>
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                )}

                {/* ETA Strip */}
                {bookingState !== 'awaiting_bids' && bookingState !== 'finalized' && (
                  <div className="flex items-center justify-between p-4 rounded-xl border"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'rgba(139,92,246,0.3)' }}>
                    <div>
                      <div className="text-[9px] font-mono mb-0.5" style={{ color: 'var(--muted-foreground)' }}>ESTIMATED ARRIVAL</div>
                      <div className="text-base font-black text-white">{etaText}</div>
                    </div>
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#8B5CF6', boxShadow: '0 0 10px #8B5CF6' }} />
                  </div>
                )}

                {/* OTP Token Display */}
                {handshakeToken && bookingState !== 'finalized' && (
                  <div className="rounded-xl border p-5 text-center"
                    style={{ background: 'rgba(16,185,129,0.04)', borderColor: 'var(--border-green)', borderStyle: 'dashed', boxShadow: '0 0 24px rgba(16,185,129,0.06)' }}>
                    <div className="text-[9px] font-mono mb-2" style={{ color: 'var(--muted-foreground)' }}>CRYPTOGRAPHIC REPAIR VERIFICATION TOKEN</div>
                    <div className="text-3xl font-black tracking-[0.3em] font-mono" style={{ color: 'var(--green)', textShadow: 'var(--glow-green-sm)' }}>
                      {handshakeToken}
                    </div>
                    <div className="text-[10px] mt-2 leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--muted-foreground)' }}>
                      Provide this code to the technician <span className="text-white font-bold">only after repair completion</span> to authorize escrow release.
                    </div>
                  </div>
                )}

                {/* Finalized */}
                {bookingState === 'finalized' && (
                  <div className="rounded-xl border p-8 text-center animate-scale-in"
                    style={{ background: 'var(--green-muted)', borderColor: 'var(--border-green)', boxShadow: 'var(--glow-green)' }}>
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--green)' }} />
                    <div className="text-sm font-bold text-white mb-1">REPAIR COMPLETE — FUNDS RELEASED</div>
                    <div className="text-[11px] max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                      Token validation succeeded. Stripe escrow split transaction routed to mechanic's ledger.
                    </div>
                    <button onClick={() => { setBookingState('idle'); setAiReport(null); setSymptomsText(''); setAssignedTech(null); setMechanicCoords(null); }}
                      className="mt-5 px-6 py-2.5 rounded-lg text-xs font-bold border transition-all duration-200"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: '#fff' }}>
                      Return to Standby
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── RIGHT MAP PANEL ── */}
        <section className="lg:col-span-7 flex flex-col gap-4 min-h-[480px]">
          {/* Map Header */}
          <div className="glass rounded-xl border px-4 py-2.5 flex items-center justify-between"
            style={{ borderColor: 'var(--border-dim)' }}>
            <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
              <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--red)' }} />
              SPATIAL ROUTING SUBSYSTEM · LEAFLET/OSM ENGINE
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-mono" style={{ color: 'var(--green)' }}>
              <span className="w-1.5 h-1.5 rounded-full status-online" />
              SIGNAL LOCK ACTIVE
            </div>
          </div>

          {/* Map itself */}
          <div className="flex-1 relative rounded-xl border overflow-hidden min-h-[400px]"
            style={{ borderColor: 'var(--border-dim)', boxShadow: bookingState !== 'idle' ? 'var(--glow-blue)' : 'none' }}>
            <Map customerLoc={customerCoords} mechanicLoc={mechanicCoords} state={bookingState} />

            {/* Floating HUD overlay */}
            {bookingState !== 'idle' && (
              <div className="absolute top-3 left-3 z-[1000] rounded-xl border p-3.5 w-52 animate-fade-up"
                style={{ background: 'var(--glass-thick)', backdropFilter: 'blur(20px)', borderColor: 'var(--border-dim)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--red)', boxShadow: 'var(--glow-red-sm)' }} />
                  <span className="text-[10px] font-bold text-white">Alex Carter</span>
                </div>
                <div className="text-[9px] font-mono" style={{ color: 'var(--muted-foreground)' }}>37.7749° N, 122.4194° W</div>
                {mechanicCoords && (
                  <div className="border-t mt-2 pt-2" style={{ borderColor: 'var(--border-dim)' }}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: 'var(--blue)', boxShadow: 'var(--glow-blue-sm)' }} />
                      <span className="text-[10px] font-bold text-white">Mobile Unit</span>
                    </div>
                    <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {mechanicCoords[0].toFixed(4)}° N, {Math.abs(mechanicCoords[1]).toFixed(4)}° W
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
