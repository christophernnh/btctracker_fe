"use client";

import { useEffect, useState } from "react";

// Structure matches our Go HTTP JSON structures
interface LeaderboardItem {
  trade_id: string;
  total_value_usd: number;
}

interface MarketEvent {
  account_id: string;
  asset: string;
  price: number;
  quantity: number;
  total_value_usd: number;
  timestamp: number;
}

interface AssetStats {
  last_price: string;
  cumulative_volume_usd: string;
  cumulative_volume_base: string;
}

export default function Home() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [liveLog, setLiveLog] = useState<MarketEvent[]>([]);

  const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

  useEffect(() => {
    // 1. Snapshot Hydration (Runs once on initial page render)
    const fetchSnapshots = async () => {
      try {
        const leaderRes = await fetch(`${BACKEND_URL}/api/leaderboard`);
        const leaderData = await leaderRes.json();
        setLeaderboard(leaderData);

        const statsRes = await fetch(`${BACKEND_URL}/api/stats/BTCUSDT`);
        const statsData = await statsRes.json();
        if (!statsData.error) {
          setStats(statsData);
        }
      } catch (err) {
        console.error("Hydration sync failure:", err);
      }
    };

    fetchSnapshots();

    // 2. Bind to realtime-SSE for data stream
    const eventSource = new EventSource(`${BACKEND_URL}/api/stream`);

    eventSource.onmessage = (event) => {
      const newEvent: MarketEvent = JSON.parse(event.data);

      // Append new event to the live transaction feed (keep last 15 items max to preserve memory)
      setLiveLog((prev) => [newEvent, ...prev.slice(0, 14)]);

      // Incrementally adjust local layout calculations for instantaneous UI response
      setStats((prevStats) => {
        const oldVolume = parseFloat(prevStats?.cumulative_volume_usd || "0");
        const oldBase = parseFloat(prevStats?.cumulative_volume_base || "0");
        return {
          last_price: newEvent.price.toFixed(2),
          cumulative_volume_usd: (oldVolume + newEvent.total_value_usd).toFixed(
            2,
          ),
          cumulative_volume_base: (oldBase + newEvent.quantity).toFixed(4),
        };
      });

      // Periodically refresh rankings in the background when big ticks hit
      if (newEvent.total_value_usd > 1000) {
        fetch(`${BACKEND_URL}/api/leaderboard`)
          .then((res) => res.json())
          .then((data) => setLeaderboard(data));
      }
    };

    // Cleanup connection when user leaves the page
    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-200 font-mono p-6 sm:p-12 selection:bg-neutral-800">
      {/* Structural Header Section */}
      <header className="border-b border-neutral-900 pb-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight uppercase text-neutral-100">
            BTC Volume Tracker
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Real-time distributed algorithmic event sourcing ledger.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-neutral-900/50 px-3 py-1.5 rounded border border-neutral-800 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-neutral-400">Pipeline Status: Live Feed</span>
        </div>
      </header>

      {/* Overview Cards Zone */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-neutral-900/30 border border-neutral-900 rounded p-5">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 block mb-1">
            Asset Token
          </span>
          <span className="text-lg font-bold text-neutral-100">BTC / USDT</span>
        </div>
        <div className="bg-neutral-900/30 border border-neutral-900 rounded p-5">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 block mb-1">
            Last Execution Price
          </span>
          <span className="text-lg font-bold text-emerald-400">
            {stats
              ? `$${parseFloat(stats.last_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : "Warming up..."}
          </span>
        </div>
        <div className="bg-neutral-900/30 border border-neutral-900 rounded p-5">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 block mb-1">
            Global Transacted Volume
          </span>
          <span className="text-lg font-bold text-neutral-300">
            {stats
              ? `$${parseFloat(stats.cumulative_volume_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "Calibrating..."}
          </span>
        </div>
      </section>

      {/* Main Content Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Leaderboard Table Component */}
        <section className="lg:col-span-5 bg-neutral-900/20 border border-neutral-900 rounded p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-4 border-b border-neutral-950 pb-2">
            Institutional Volume Leaderboard
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-neutral-500 border-b border-neutral-900">
                  <th className="pb-3 font-medium">Rank</th>
                  <th className="pb-3 font-medium">Aggregate Trade ID</th>
                  <th className="pb-3 font-medium text-right">
                    Aggregated Volume (USD)
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((item, index) => (
                  <tr
                    key={item.trade_id}
                    className="border-b border-neutral-900/50 hover:bg-neutral-900/10 transition-colors"
                  >
                    <td className="py-3 text-neutral-600 font-bold">
                      {(index + 1).toString().padStart(2, "0")}
                    </td>
                    <td className="py-3 text-neutral-300">{item.trade_id}</td>
                    <td className="py-3 text-right text-neutral-100 font-bold">
                      $
                      {item.total_value_usd.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
                {leaderboard.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-8 text-center text-neutral-600"
                    >
                      Waiting for data blocks to ingest...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right Side: Live Stream Logs Component */}
        <section className="lg:col-span-7 bg-neutral-900/20 border border-neutral-900 rounded p-6 flex flex-col">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-4 border-b border-neutral-950 pb-2">
            Live Stream Transaction Ledger
          </h2>
          <div className="flex-1 space-y-2 max-h-[420px] overflow-y-auto pr-2 scrollbar-thin">
            {liveLog.map((log, idx) => {
              const isWhale = log.total_value_usd >= 50000;
              return (
                <div
                  key={idx}
                  className={`text-xs p-2.5 rounded border transition-all flex justify-between items-center ${
                    isWhale
                      ? "bg-amber-950/20 border-amber-900/50 text-amber-200/90 font-bold"
                      : "bg-neutral-900/40 border-neutral-900 text-neutral-400"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={
                        isWhale ? "text-amber-500" : "text-neutral-600"
                      }
                    >
                      {isWhale ? "⚡ [WHALE]" : "• [TRADE]"}
                    </span>
                    <span className="text-neutral-300 font-medium">
                      {log.account_id}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={
                        isWhale ? "text-amber-400" : "text-neutral-200"
                      }
                    >
                      {log.quantity.toFixed(4)} BTC
                    </span>
                    <span className="mx-2 text-neutral-600">@</span>
                    <span>${log.price.toFixed(2)}</span>
                    <span
                      className={`ml-3 inline-block min-w-[80px] text-right ${isWhale ? "text-amber-400" : "text-neutral-500"}`}
                    >
                      (${log.total_value_usd.toFixed(2)})
                    </span>
                  </div>
                </div>
              );
            })}
            {liveLog.length === 0 && (
              <div className="text-center text-neutral-600 py-16">
                Listening to{" "}
                <code className="bg-neutral-900 px-1 py-0.5 rounded text-neutral-500">
                  channel:market_events
                </code>
                ...
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
