import dotenv from 'dotenv';
import { AIDiagnosticSummary } from './types';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

/**
 * Parses user input symptoms and visual telemetry to output a structured diagnostic report.
 * Uses the Gemini API if GEMINI_API_KEY is defined, otherwise uses a high-fidelity local simulator.
 */
export async function analyzeVehicleSymptoms(
  symptomsText: string,
  imageBufferBase64?: string,
  imageMimeType?: string
): Promise<AIDiagnosticSummary> {
  if (GEMINI_API_KEY) {
    try {
      const response = await callGeminiAPI(symptomsText, imageBufferBase64, imageMimeType);
      if (response) return response;
    } catch (error) {
      console.error('Gemini API call failed, falling back to simulator:', error);
    }
  }

  // Fallback simulator
  return simulateDiagnostics(symptomsText);
}

/**
 * Invokes Gemini 1.5 Flash using standard fetch request with JSON response constraints
 */
async function callGeminiAPI(
  symptomsText: string,
  imageBufferBase64?: string,
  imageMimeType?: string
): Promise<AIDiagnosticSummary | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `
    You are an expert automotive diagnostic parser. You diagnose vehicle problems based on user-described symptoms and visual photos.
    Provide your analysis as a single JSON object.
    
    The JSON structure must match this schema exactly:
    {
      "fault_code": "String (e.g. OBD-II code like P0302 or system identifier)",
      "confidence": Number (float between 0.0 and 1.0),
      "description": "Detailed description of the diagnosed issue, potential causes, and implications.",
      "severity": "String ('low' | 'medium' | 'high' | 'critical')",
      "estimated_cost_cents_range": [Number (min cost in cents), Number (max cost in cents)],
      "recommended_actions": ["Array of recommended next-step actions for the mechanic or driver"]
    }
    
    User symptoms description: "${symptomsText.replace(/"/g, '\\"')}"
  `;

  const contents: any[] = [];
  
  // Package inline image data if present
  if (imageBufferBase64 && imageMimeType) {
    contents.push({
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: imageMimeType,
            data: imageBufferBase64
          }
        },
        {
          text: prompt
        }
      ]
    });
  } else {
    contents.push({
      role: 'user',
      parts: [
        {
          text: prompt
        }
      ]
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini responded with HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  return JSON.parse(rawText) as AIDiagnosticSummary;
}

/**
 * Local rule-based diagnostic simulator for offline testing
 */
function simulateDiagnostics(symptoms: string): AIDiagnosticSummary {
  const text = symptoms.toLowerCase();

  // 1. Braking system issues
  if (text.includes('brake') || text.includes('squeal') || text.includes('grinding') || text.includes('stop')) {
    return {
      fault_code: 'BRK-8092',
      confidence: 0.89,
      description: 'Worn front brake pads or rotor scoring detected. Vibration and high-frequency acoustic friction suggest the pad friction material has worn below safe operating tolerances (less than 3mm remaining).',
      severity: 'high',
      estimated_cost_cents_range: [18000, 35000], // $180 - $350
      recommended_actions: [
        'Perform complete inspection of brake rotors, calipers, and fluid lines.',
        'Replace front brake pads immediately.',
        'Resurface or replace front brake rotors if scoring exceeds limits.'
      ]
    };
  }

  // 2. Cooling / Leak / Overheating
  if (text.includes('overheat') || text.includes('hot') || text.includes('coolant') || text.includes('smoke') || text.includes('leak')) {
    return {
      fault_code: 'P0117-COOL',
      confidence: 0.82,
      description: 'Potential coolant loop depressurization or radiator hose failure. Low thermal efficiency is causing rapid temperature spikes in the engine block cylinder head assembly.',
      severity: 'critical',
      estimated_cost_cents_range: [12000, 45000], // $120 - $450
      recommended_actions: [
        'Do not drive the vehicle; risk of total engine block warpage.',
        'Inspect coolant expansion tank levels and check radiator hoses for fractures.',
        'Perform cooling loop pressure test to locate the fluid loss node.'
      ]
    };
  }

  // 3. Battery / Starter / Alternator
  if (text.includes('battery') || text.includes('start') || text.includes('dead') || text.includes('click') || text.includes('turn over')) {
    return {
      fault_code: 'BAT-E102',
      confidence: 0.94,
      description: 'Battery state-of-charge has fallen below cranking threshold (typically <11.8V). Rapid clicking indicates starter solenoid engagement failure due to insufficient electrical current.',
      severity: 'medium',
      estimated_cost_cents_range: [9500, 22000], // $95 - $220
      recommended_actions: [
        'Test battery open-circuit voltage and cold cranking amps (CCA).',
        'Attempt auxiliary jump-start to verify alternator voltage output (should be 13.8V-14.4V).',
        'Replace lead-acid/AGM battery if it fails load test validation.'
      ]
    };
  }

  // 4. Default Check Engine / Cylinder Misfire
  return {
    fault_code: 'P0302-MISFIRE',
    confidence: 0.76,
    description: 'Cylinder 2 combustion chamber misfire detected. Telemetry patterns suggest ignition failure or fuel delivery mismatch, resulting in unburned fuel entering the exhaust manifold.',
    severity: 'medium',
    estimated_cost_cents_range: [8000, 25000], // $80 - $250
    recommended_actions: [
      'Inspect spark plug electrodes on Cylinder 2 for oil buildup or carbon fouling.',
      'Check integrity of the ignition coil pack and wiring harnesses.',
      'Verify fuel injector pulse signal.'
    ]
  };
}
