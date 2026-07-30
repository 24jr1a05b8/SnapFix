"use client";

import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MapProps {
  customerLoc: [number, number] | null;
  mechanicLoc: [number, number] | null;
  state?: string;
}

export default function Map({ customerLoc, mechanicLoc, state }: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const mechanicMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (typeof window === 'undefined') return;

    // Initialize Map instance once
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true
      }).setView([37.7749, -122.4194], 13); // Default SF view

      // Add elegant CartoDB Dark Matter tile layer to match dark aesthetic
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        subdomains: 'abcd'
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Handle Customer location marker
    if (customerLoc) {
      const customIcon = L.divIcon({
        className: 'pulse-marker-customer',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      if (customerMarkerRef.current) {
        customerMarkerRef.current.setLatLng(customerLoc);
      } else {
        customerMarkerRef.current = L.marker(customerLoc, { icon: customIcon })
          .addTo(map)
          .bindPopup('Commuter Breakdown Node');
      }
    } else {
      if (customerMarkerRef.current) {
        customerMarkerRef.current.remove();
        customerMarkerRef.current = null;
      }
    }

    // Handle Mechanic location marker
    if (mechanicLoc) {
      const customIcon = L.divIcon({
        className: 'pulse-marker-tech',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      if (mechanicMarkerRef.current) {
        mechanicMarkerRef.current.setLatLng(mechanicLoc);
      } else {
        mechanicMarkerRef.current = L.marker(mechanicLoc, { icon: customIcon })
          .addTo(map)
          .bindPopup('Assigned Mechanic Service Vehicle');
      }
    } else {
      if (mechanicMarkerRef.current) {
        mechanicMarkerRef.current.remove();
        mechanicMarkerRef.current = null;
      }
    }

    // Draw routing vector if both coordinates exist
    if (customerLoc && mechanicLoc) {
      const points: [number, number][] = [mechanicLoc, customerLoc];
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(points);
      } else {
        routeLineRef.current = L.polyline(points, {
          color: '#0066FF',
          weight: 4,
          opacity: 0.8,
          dashArray: '6, 12'
        }).addTo(map);
      }

      // Re-center and pad map boundaries around both markers
      const bounds = L.latLngBounds([customerLoc, mechanicLoc]);
      map.fitBounds(bounds, { padding: [60, 60] });
    } else {
      if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }

      if (customerLoc) {
        map.setView(customerLoc, 15);
      } else if (mechanicLoc) {
        map.setView(mechanicLoc, 15);
      }
    }

  }, [customerLoc, mechanicLoc, state]);

  return (
    <div className="relative w-full h-full min-h-[350px] rounded-xl border border-border overflow-hidden bg-background shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full absolute inset-0" />
      
      {/* Map UI overlays */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-card/90 backdrop-blur border border-border px-3 py-1.5 rounded-lg text-[11px] font-mono text-muted-foreground flex items-center gap-2 shadow-lg">
        <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse"></span>
        SPATIAL ROUTING SUBSYSTEM
      </div>

      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5">
        <button 
          onClick={() => mapRef.current?.zoomIn()}
          className="w-8 h-8 rounded-lg bg-card/95 hover:bg-primary backdrop-blur border border-border text-foreground hover:text-white flex items-center justify-center font-bold text-sm shadow transition-colors"
        >
          +
        </button>
        <button 
          onClick={() => mapRef.current?.zoomOut()}
          className="w-8 h-8 rounded-lg bg-card/95 hover:bg-primary backdrop-blur border border-border text-foreground hover:text-white flex items-center justify-center font-bold text-sm shadow transition-colors"
        >
          −
        </button>
      </div>
    </div>
  );
}
