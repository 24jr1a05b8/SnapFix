"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

// Animated counter hook
function useCounter(target: number, duration: number = 1800) {
  const [value, setValue] = useState(0);
  const ref = useRef(false);
  useEffect(() => {
    if (ref.current) return;
    ref.current = true;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setValue(target);
        clearInterval(interval);
      } else {
        setValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [target, duration]);
  return value;
}

export default function Home() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [techCount, setTechCount] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<null | 'customer' | 'mechanic'>(null);
  const [tick, setTick] = useState(0);
  const dispatchRate = useCounter(92.4, 2000);
  const resolutionTime = useCounter(38, 2200);

  // Animate clock tick for live HUD feel
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // API Health check
  useEffect(() => {
    async function check() {
      try {
        const r = await fetch('http://localhost:3001/api/v1/health');
        if (r.ok) {
          setApiStatus('online');
          const tr = await fetch('http://localhost:3001/api/v1/technicians');
          if (tr.ok) setTechCount((await tr.json()).length);
        } else setApiStatus('offline');
      } catch { setApiStatus('offline'); }
    }
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className="relative min-h-screen bg-[#0A0A0C] overflow-hidden flex flex-col select-none">

      {/* ─── Ambient Glow Orbs ─── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,102,255,0.13) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute -bottom-60 -right-40 w-[800px] h-[800px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,102,255,0.05) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      {/* ─── Animated Dot Grid Background ─── */}
      <div className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(39,39,50,0.9) 1px, transparent 1px)',
          backgroundSize: '28px 28px'
        }} />

      {/* ─── Top Navigation Bar ─── */}
      <header className="relative z-20 flex items-center justify-between px-6 md:px-10 py-4 border-b border-[#272732]/60"
        style={{ background: 'rgba(20,20,26,0.55)', backdropFilter: 'blur(20px)' }}>
        
        {/* Wordmark */}
        <div className="flex items-center gap-3.5">
          {/* Animated Radar SVG */}
          <div className="relative w-9 h-9 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full">
              <circle cx="18" cy="18" r="16" stroke="#0066FF" strokeWidth="1" fill="none" strokeOpacity="0.3" />
              <circle cx="18" cy="18" r="10" stroke="#0066FF" strokeWidth="0.8" fill="none" strokeOpacity="0.5" />
              <circle cx="18" cy="18" r="4" fill="#0066FF" />
              {/* Rotating sweep */}
              <g style={{ transformOrigin: '18px 18px', animation: 'spin 3s linear infinite' }}>
                <line x1="18" y1="18" x2="18" y2="2" stroke="#0066FF" strokeWidth="1.5" strokeOpacity="0.9" />
                <line x1="18" y1="18" x2="34" y2="18" stroke="#0066FF" strokeWidth="0.4" strokeOpacity="0.2" />
              </g>
              <circle cx="24" cy="12" r="1.5" fill="#10B981" style={{ animation: 'pulse 1.6s infinite' }} />
              <circle cx="10" cy="22" r="1" fill="#0066FF" style={{ animation: 'pulse 2.2s infinite 0.5s' }} />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-widest text-white uppercase">SnapFix</span>
              <span className="text-[9px] font-mono bg-[#0066FF]/20 text-[#0066FF] border border-[#0066FF]/30 px-1.5 py-0.5 rounded">v1.0.0</span>
            </div>
            <p className="text-[9px] font-mono text-[#9CA3AF] tracking-widest">ON-DEMAND VEHICLE DISPATCH ECOSYSTEM</p>
          </div>
        </div>

        {/* Live System Clock + API Status */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 font-mono text-xs text-[#9CA3AF]">
            <svg className="w-3.5 h-3.5 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            {timeStr}
          </div>
          <div className="w-px h-5 bg-[#272732]" />
          <div className={`flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded-lg border ${
            apiStatus === 'online' 
              ? 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]' 
              : apiStatus === 'offline' 
                ? 'bg-[#EF4444]/10 border-[#EF4444]/25 text-[#EF4444]'
                : 'bg-yellow-500/10 border-yellow-500/25 text-yellow-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              apiStatus === 'online' ? 'bg-[#10B981] animate-pulse' : 
              apiStatus === 'offline' ? 'bg-[#EF4444]' : 'bg-yellow-500 animate-pulse'
            }`} />
            {apiStatus === 'online' ? 'CORE API ONLINE' : apiStatus === 'offline' ? 'API OFFLINE' : 'POLLING...'}
          </div>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <main className="relative z-10 flex-1 flex flex-col">

        {/* Hero Headline */}
        <div className="text-center pt-16 pb-10 px-6">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono text-[#9CA3AF] border border-[#272732] bg-[#14141A]/60 px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            REALTIME GEODETIC DISPATCH SUBSYSTEM ACTIVE
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tight mb-5">
            AI-Engineered
            <span className="block" style={{
              background: 'linear-gradient(135deg, #0066FF 0%, #10B981 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Roadside Dispatch
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-[#9CA3AF] text-sm md:text-base leading-relaxed">
            Multimodal AI diagnostics, escrow-backed payouts, and sub-5-minute spatial matchmaking.
            <br className="hidden md:block" /> A high-precision instrument built for field reliability.
          </p>
        </div>

        {/* ─── KPI Metric Strip ─── */}
        <div className="flex justify-center mb-10 px-6">
          <div className="flex flex-wrap items-center justify-center gap-0 max-w-3xl w-full border border-[#272732] rounded-2xl overflow-hidden divide-x divide-[#272732]"
            style={{ background: 'rgba(20,20,26,0.60)', backdropFilter: 'blur(20px)' }}>
            {[
              { label: 'DISPATCH CONVERSION', value: `${dispatchRate}%`, sub: 'Target >92%', color: '#10B981' },
              { label: 'AVG RESOLUTION TIME', value: `${resolutionTime}min`, sub: 'Urban Sector', color: '#0066FF' },
              { label: 'ACTIVE TECHNICIANS', value: techCount, sub: 'Seeded Profiles', color: '#10B981' },
              { label: 'MATCH WINDOW SLA', value: '≤5 min', sub: 'T_match target', color: '#0066FF' },
            ].map((m, i) => (
              <div key={i} className="flex-1 min-w-[130px] px-5 py-4 text-center">
                <div className="text-[9px] font-mono text-[#9CA3AF] mb-1 tracking-wider">{m.label}</div>
                <div className="text-xl font-black" style={{ color: m.color }}>{m.value}</div>
                <div className="text-[9px] text-[#9CA3AF] mt-0.5">{m.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Dual Portal Cards ─── */}
        <div className="flex-1 flex flex-col lg:flex-row gap-5 px-6 md:px-10 pb-6 max-w-7xl mx-auto w-full">

          {/* ── Customer Card ── */}
          <Link href="/customer" className="flex-1 group cursor-pointer"
            onMouseEnter={() => setHoveredCard('customer')}
            onMouseLeave={() => setHoveredCard(null)}>
            <div className="relative h-full min-h-[440px] rounded-2xl overflow-hidden border transition-all duration-500"
              style={{
                background: hoveredCard === 'customer'
                  ? 'rgba(239,68,68,0.07)'
                  : 'rgba(20,20,26,0.65)',
                backdropFilter: 'blur(24px)',
                borderColor: hoveredCard === 'customer' ? 'rgba(239,68,68,0.4)' : 'rgba(39,39,50,0.8)',
                boxShadow: hoveredCard === 'customer' ? '0 0 60px rgba(239,68,68,0.1), inset 0 1px 0 rgba(239,68,68,0.15)' : 'none'
              }}>

              {/* Corner accent */}
              <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 100% 0%, rgba(239,68,68,0.12) 0%, transparent 70%)' }} />

              {/* Inline SVG — broken car illustration */}
              <div className="p-7 pb-0">
                <svg viewBox="0 0 320 160" className="w-full h-32 opacity-80">
                  {/* Road */}
                  <rect x="0" y="130" width="320" height="30" fill="#14141A" />
                  <rect x="40" y="141" width="40" height="4" fill="#272732" rx="2" />
                  <rect x="140" y="141" width="40" height="4" fill="#272732" rx="2" />
                  <rect x="240" y="141" width="40" height="4" fill="#272732" rx="2" />
                  {/* Car body */}
                  <rect x="60" y="90" width="160" height="44" fill="#1E1E26" rx="6" />
                  <path d="M100 90 L130 55 L200 55 L225 90 Z" fill="#14141A" stroke="#272732" strokeWidth="1" />
                  {/* Windows */}
                  <rect x="133" y="60" width="50" height="28" fill="#0A0A0C" rx="3" opacity="0.8" />
                  <rect x="138" y="63" width="40" height="22" fill="#0066FF" rx="2" opacity="0.1" />
                  {/* Wheels */}
                  <circle cx="110" cy="134" r="14" fill="#0A0A0C" stroke="#272732" strokeWidth="2" />
                  <circle cx="110" cy="134" r="6" fill="#1E1E26" />
                  <circle cx="210" cy="134" r="14" fill="#0A0A0C" stroke="#272732" strokeWidth="2" />
                  <circle cx="210" cy="134" r="6" fill="#1E1E26" />
                  {/* Warning triangle */}
                  <polygon points="280,50 300,85 260,85" fill="none" stroke="#EF4444" strokeWidth="2.5" />
                  <text x="280" y="78" textAnchor="middle" fill="#EF4444" fontSize="16" fontWeight="bold">!</text>
                  {/* Steam puffs */}
                  <circle cx="68" cy="75" r="5" fill="#272732" style={{ animation: 'pulse 1.5s infinite' }} opacity="0.6" />
                  <circle cx="58" cy="62" r="4" fill="#272732" style={{ animation: 'pulse 1.5s infinite 0.3s' }} opacity="0.4" />
                  <circle cx="72" cy="50" r="3" fill="#272732" style={{ animation: 'pulse 1.5s infinite 0.6s' }} opacity="0.2" />
                  {/* SOS beacon */}
                  <circle cx="164" cy="48" r="5" fill="#EF4444" style={{ animation: 'pulse 0.8s infinite' }} />
                  <circle cx="164" cy="48" r="10" fill="none" stroke="#EF4444" strokeWidth="1" style={{ animation: 'ping 1s infinite' }} opacity="0.5" />
                  {/* Headlights glow */}
                  <ellipse cx="222" cy="112" rx="14" ry="6" fill="#0066FF" opacity="0.08" />
                </svg>
              </div>

              <div className="p-7 pt-3 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                      <span className="text-[9px] font-mono text-[#EF4444] tracking-widest">PERSONA CLASS A — COMMUTER</span>
                    </div>
                    <h2 className="text-2xl font-black text-white">Stranded Commuter<br/>Emergency Console</h2>
                  </div>
                  <div className="text-2xl opacity-20 group-hover:opacity-60 transition-opacity">→</div>
                </div>

                <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
                  One-tap GPS capture, multimodal AI fault analysis, Stripe escrow authorization, 
                  and live Leaflet route tracking — all in a single dispatch sequence.
                </p>

                {/* Feature chips */}
                <div className="flex flex-wrap gap-2">
                  {['US-201 Emergency Dispatch', 'Gemini-1.5-Flash Diagnostics', 'Stripe Escrow Hold', 'Live Map Sync'].map(f => (
                    <span key={f} className="text-[10px] font-mono px-2 py-1 rounded-md border border-[#272732] bg-[#0A0A0C]/60 text-[#9CA3AF]">
                      {f}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-auto pt-2">
                  <div className="w-full py-3.5 rounded-xl text-center text-sm font-bold transition-all duration-300"
                    style={{
                      background: hoveredCard === 'customer'
                        ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                        : 'rgba(239,68,68,0.12)',
                      color: '#ffffff',
                      border: '1px solid rgba(239,68,68,0.3)',
                      boxShadow: hoveredCard === 'customer' ? '0 8px 24px rgba(239,68,68,0.3)' : 'none'
                    }}>
                    Launch Commuter Portal
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* ── Mechanic Card ── */}
          <Link href="/mechanic" className="flex-1 group cursor-pointer"
            onMouseEnter={() => setHoveredCard('mechanic')}
            onMouseLeave={() => setHoveredCard(null)}>
            <div className="relative h-full min-h-[440px] rounded-2xl overflow-hidden border transition-all duration-500"
              style={{
                background: hoveredCard === 'mechanic'
                  ? 'rgba(0,102,255,0.07)'
                  : 'rgba(20,20,26,0.65)',
                backdropFilter: 'blur(24px)',
                borderColor: hoveredCard === 'mechanic' ? 'rgba(0,102,255,0.4)' : 'rgba(39,39,50,0.8)',
                boxShadow: hoveredCard === 'mechanic' ? '0 0 60px rgba(0,102,255,0.1), inset 0 1px 0 rgba(0,102,255,0.15)' : 'none'
              }}>

              {/* Corner accent */}
              <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 100% 0%, rgba(0,102,255,0.12) 0%, transparent 70%)' }} />

              {/* Inline SVG — mechanic van / radar illustration */}
              <div className="p-7 pb-0">
                <svg viewBox="0 0 320 160" className="w-full h-32 opacity-80">
                  {/* Road */}
                  <rect x="0" y="130" width="320" height="30" fill="#14141A" />
                  <rect x="40" y="141" width="40" height="4" fill="#272732" rx="2" />
                  <rect x="140" y="141" width="40" height="4" fill="#272732" rx="2" />
                  <rect x="240" y="141" width="40" height="4" fill="#272732" rx="2" />
                  {/* Van body */}
                  <rect x="80" y="75" width="155" height="56" fill="#1E1E26" rx="5" />
                  <rect x="80" y="75" width="48" height="56" fill="#14141A" rx="5" />
                  {/* Van cab windows */}
                  <rect x="86" y="82" width="34" height="24" fill="#0A0A0C" rx="3" />
                  <rect x="89" y="85" width="28" height="18" fill="#0066FF" rx="2" opacity="0.12" />
                  {/* Van side stripe */}
                  <rect x="128" y="95" width="100" height="3" fill="#0066FF" opacity="0.6" />
                  {/* Antenna */}
                  <line x1="200" y1="75" x2="200" y2="42" stroke="#272732" strokeWidth="1.5" />
                  <circle cx="200" cy="40" r="3" fill="#10B981" style={{ animation: 'pulse 1s infinite' }} />
                  {/* Signal rings */}
                  <circle cx="200" cy="40" r="8" fill="none" stroke="#10B981" strokeWidth="0.8" opacity="0.4" style={{ animation: 'ping 1.5s infinite' }} />
                  <circle cx="200" cy="40" r="16" fill="none" stroke="#10B981" strokeWidth="0.5" opacity="0.2" style={{ animation: 'ping 1.5s infinite 0.3s' }} />
                  {/* Wrench icon */}
                  <g transform="translate(258,70) rotate(-45)" opacity="0.7">
                    <rect x="-3" y="-15" width="6" height="24" fill="#0066FF" rx="2" />
                    <circle cx="0" cy="-15" r="6" fill="none" stroke="#0066FF" strokeWidth="2.5" />
                  </g>
                  {/* Wheels */}
                  <circle cx="116" cy="134" r="14" fill="#0A0A0C" stroke="#272732" strokeWidth="2" />
                  <circle cx="116" cy="134" r="6" fill="#1E1E26" />
                  <circle cx="208" cy="134" r="14" fill="#0A0A0C" stroke="#272732" strokeWidth="2" />
                  <circle cx="208" cy="134" r="6" fill="#1E1E26" />
                  {/* Headlights glow */}
                  <ellipse cx="80" cy="108" rx="12" ry="6" fill="#0066FF" opacity="0.15" />
                  {/* Routing line ahead */}
                  <line x1="30" y1="107" x2="78" y2="107" stroke="#0066FF" strokeWidth="2" strokeDasharray="6,4" opacity="0.5" />
                  <circle cx="22" cy="107" r="4" fill="#EF4444" />
                </svg>
              </div>

              <div className="p-7 pt-3 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#0066FF] animate-pulse" />
                      <span className="text-[9px] font-mono text-[#0066FF] tracking-widest">PERSONA CLASS B — TECHNICIAN</span>
                    </div>
                    <h2 className="text-2xl font-black text-white">Mobile Field Specialist<br/>Dispatch Console</h2>
                  </div>
                  <div className="text-2xl opacity-20 group-hover:opacity-60 transition-opacity">→</div>
                </div>

                <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
                  Stream real-time geodetic coordinate pulses, accept AI-briefed job offers, 
                  execute route simulations, and settle escrow with cryptographic OTP tokens.
                </p>

                {/* Feature chips */}
                <div className="flex flex-wrap gap-2">
                  {['US-202 AI Diagnostic Briefs', 'WebSocket Coord Stream', 'Haversine Spatial Match', 'OTP Escrow Release'].map(f => (
                    <span key={f} className="text-[10px] font-mono px-2 py-1 rounded-md border border-[#272732] bg-[#0A0A0C]/60 text-[#9CA3AF]">
                      {f}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-auto pt-2">
                  <div className="w-full py-3.5 rounded-xl text-center text-sm font-bold transition-all duration-300"
                    style={{
                      background: hoveredCard === 'mechanic'
                        ? 'linear-gradient(135deg, #0066FF 0%, #0052CC 100%)'
                        : 'rgba(0,102,255,0.12)',
                      color: '#ffffff',
                      border: '1px solid rgba(0,102,255,0.3)',
                      boxShadow: hoveredCard === 'mechanic' ? '0 8px 24px rgba(0,102,255,0.3)' : 'none'
                    }}>
                    Launch Technician Portal
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* ─── Architecture Blueprint Strip ─── */}
        <div className="px-6 md:px-10 pb-8 max-w-7xl mx-auto w-full">
          <div className="rounded-2xl border border-[#272732]/60 overflow-hidden"
            style={{ background: 'rgba(20,20,26,0.50)', backdropFilter: 'blur(16px)' }}>
            <div className="px-6 py-3 border-b border-[#272732]/60 flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#9CA3AF] tracking-widest">SYSTEM ARCHITECTURE — LIVE TOPOLOGY</span>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#10B981]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                NODE GRAPH ACTIVE
              </div>
            </div>
            <div className="p-5 overflow-x-auto">
              <svg viewBox="0 0 760 90" className="w-full min-w-[560px] h-16">
                {/* Connection lines */}
                <line x1="110" y1="45" x2="175" y2="45" stroke="#0066FF" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
                <line x1="285" y1="45" x2="340" y2="45" stroke="#0066FF" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
                <line x1="450" y1="45" x2="510" y2="45" stroke="#0066FF" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
                <line x1="620" y1="45" x2="680" y2="45" stroke="#10B981" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
                {/* Nodes */}
                {[
                  { x: 55, label: 'Next.js 16', sub: 'Frontend', color: '#0066FF' },
                  { x: 230, label: 'Express API', sub: 'REST+WSS', color: '#0066FF' },
                  { x: 395, label: 'SQLite / PG', sub: 'Spatial DB', color: '#10B981' },
                  { x: 560, label: 'Gemini AI', sub: 'Diagnostics', color: '#0066FF' },
                  { x: 720, label: 'Stripe', sub: 'Escrow', color: '#10B981' },
                ].map((n) => (
                  <g key={n.x}>
                    <rect x={n.x - 52} y="15" width="104" height="60" rx="8" fill="#14141A" stroke={n.color} strokeWidth="0.8" strokeOpacity="0.4" />
                    <circle cx={n.x - 36} cy="31" r="4" fill={n.color} opacity="0.8" />
                    <text x={n.x - 26} y="35" fill="#F3F4F6" fontSize="9.5" fontFamily="monospace" fontWeight="600">{n.label}</text>
                    <text x={n.x} y="53" fill="#9CA3AF" fontSize="8" fontFamily="monospace" textAnchor="middle">{n.sub}</text>
                  </g>
                ))}
                {/* Animated pulse dots on lines */}
                <circle r="3" fill="#0066FF" opacity="0.8">
                  <animateMotion dur="2s" repeatCount="indefinite" path="M110,45 L175,45" />
                </circle>
                <circle r="3" fill="#0066FF" opacity="0.8">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="0.5s" path="M285,45 L340,45" />
                </circle>
                <circle r="3" fill="#10B981" opacity="0.8">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="1s" path="M450,45 L510,45" />
                </circle>
                <circle r="3" fill="#10B981" opacity="0.8">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="1.5s" path="M620,45 L680,45" />
                </circle>
              </svg>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-[#272732]/50 px-6 md:px-10 py-4"
        style={{ background: 'rgba(10,10,12,0.70)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono text-[#9CA3AF]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF]" />
              NFR-2.2: P99 ≤ 250ms WebSocket Latency
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              NFR-2.3: PCI-DSS Level 1 · TLS 1.3 · AES-256
            </span>
          </div>
          <span>ANTIGRAVITY SYSTEM © 2026 · {timeStr} LOCAL</span>
        </div>
      </footer>

      {/* Global keyframe animations */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ping { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2); opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
