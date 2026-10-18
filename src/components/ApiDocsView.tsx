import React, { useState } from 'react';
import type { ScoreboardState } from '../types/scoreboard.ts';
import {
  Code2,
  Copy,
  Check,
  Cpu,
  Radio,
  Server,
  Terminal,
  Send,
  Zap,
} from 'lucide-react';

interface ApiDocsViewProps {
  state: ScoreboardState;
}

export const ApiDocsView: React.FC<ApiDocsViewProps> = ({ state }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [testOutput, setTestOutput] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const testGetScoreboard = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/scoreboard');
      const data = await res.json();
      setTestOutput(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setTestOutput(`Error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const endpoints = [
    {
      method: 'GET',
      path: '/api/scoreboard',
      desc: 'Mendapatkan seluruh state papan skor: nilai semua regu, babak aktif, timer, dan antrean bel.',
      sampleCurl: `curl -X GET "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/scoreboard"`,
    },
    {
      method: 'GET',
      path: '/api/teams',
      desc: 'Mendapatkan daftar regu, poin akumulasi, dan warna identitas untuk display panggung digital.',
      sampleCurl: `curl -X GET "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/teams"`,
    },
    {
      method: 'GET',
      path: '/api/timer',
      desc: 'Mendapatkan status detik timer lomba saat ini dan status berjalan/jeda.',
      sampleCurl: `curl -X GET "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/timer"`,
    },
    {
      method: 'POST',
      path: '/api/scores/delta',
      desc: 'Menambah / mengurangi poin regu secara instan melalui sistem eksternal.',
      sampleCurl: `curl -X POST "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/scores/delta" \\
  -H "Content-Type: application/json" \\
  -d '{"teamId": "regu-a", "delta": 100, "note": "Skor dari tombol fisik juri"}'`,
    },
    {
      method: 'POST',
      path: '/api/buzzer/buzz',
      desc: 'Memicu bel regu dari tombol fisik / sensor hardware eksternal (ESP32/Arduino).',
      sampleCurl: `curl -X POST "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/buzzer/buzz" \\
  -H "Content-Type: application/json" \\
  -d '{"teamId": "regu-a"}'`,
    },
  ];

  const esp32Code = `// Contoh Kode ESP32 / Arduino untuk Bel Fisik & Papan LED Digital
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "WIFI_PANITIA";
const char* password = "PASSWORD_WIFI";
const char* serverUrl = "${typeof window !== 'undefined' ? window.location.origin : 'http://192.168.1.100:3000'}/api/buzzer/buzz";

const int BUTTON_PIN = 4; // Pin tombol fisik di meja regu

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
}

void loop() {
  if (digitalRead(BUTTON_PIN) == LOW) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    int httpResponseCode = http.POST("{\\"teamId\\":\\"regu-a\\"}");
    Serial.println(httpResponseCode);
    http.end();
    delay(2000); // debounce
  }
}`;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      {/* Intro Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-black">
            <Code2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">
                Integrasi API Papan Skor Digital & Hardware
              </h2>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold px-2 py-0.5 rounded">
                REST & WEBSOCKET
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Gunakan API ini untuk menghubungkan papan videotron LED eksternal, display matrix P10,
              tombol bel kabel fisik (ESP32/Raspberry Pi), atau software broadcast (OBS Studio).
            </p>
          </div>
        </div>

        {/* WebSocket Stream Details */}
        <div className="mt-5 p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-white">
                Live WebSocket Stream URL (Sub-millisecond Realtime):
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              ws:// atau wss://
            </span>
          </div>
          <div className="mt-2 font-mono text-xs text-amber-400 bg-slate-900 p-2.5 rounded-lg border border-slate-800 break-all select-all">
            {typeof window !== 'undefined'
              ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
              : 'ws://localhost:3000/ws'}
          </div>
        </div>
      </div>

      {/* REST Endpoints Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-400" />
            <span>Daftar REST API Endpoints</span>
          </h3>

          <button
            onClick={testGetScoreboard}
            disabled={isTesting}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isTesting ? 'Menguji...' : 'Uji Endpoint /api/scoreboard'}</span>
          </button>
        </div>

        {/* Live response test area */}
        {testOutput && (
          <div className="mb-6 bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-bold text-emerald-400">Response JSON (HTTP 200 OK):</span>
              <button
                onClick={() => setTestOutput('')}
                className="text-[11px] text-slate-500 hover:text-white"
              >
                Tutup
              </button>
            </div>
            <pre className="text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto">
              {testOutput}
            </pre>
          </div>
        )}

        <div className="space-y-4">
          {endpoints.map((ep, idx) => (
            <div
              key={ep.path}
              className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded ${
                      ep.method === 'GET'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono text-xs font-bold text-white">{ep.path}</span>
                </div>

                <button
                  onClick={() => copyToClipboard(ep.sampleCurl, idx)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-bold rounded border border-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" /> Tersalin!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Salin cURL
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-400 mb-2">{ep.desc}</p>

              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                <code>{ep.sampleCurl}</code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hardware / ESP32 Example */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Contoh Integrasi Hardware Bel Fisik (ESP32 / Arduino C++)</span>
          </h3>
          <button
            onClick={() => copyToClipboard(esp32Code, 999)}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            {copiedIndex === 999 ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Tersalin!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Salin Kode ESP32
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Jika panitia menggunakan tombol bel fisik di meja peserta, ESP32 dapat langsung mengirimkan
          HTTP POST saat tombol ditekan untuk trigger bel real-time.
        </p>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-56 overflow-y-auto font-mono text-[11px] text-slate-300">
          <pre>{esp32Code}</pre>
        </div>
      </div>
    </div>
  );
};
