'use client';

import { useEffect, useState, useCallback } from 'react';

interface Assignment {
  leadId: number;
  leadName: string;
  service: string;
  city: string;
  phone: string;
  assignedAt: string;
}

interface ProviderData {
  id: number;
  name: string;
  monthlyQuota: number;
  leadsReceived: number;
  remainingQuota: number;
  quotaUsedPercent: number;
  assignments: Assignment[];
}

export default function DashboardPage() {
  const [providers, setProviders] = useState<ProviderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      if (data.providers) setProviders(data.providers);
    } catch (err) {
      console.error('Failed to fetch providers', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();

    // Connect to SSE for real-time updates
    const eventSource = new EventSource('/api/leads/stream');

    eventSource.onopen = () => setConnected(true);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'CONNECTED') {
        setConnected(true);
      } else if (data.type === 'NEW_LEAD') {
        setLastUpdate(new Date().toLocaleTimeString());
        // Flash the assigned providers
        const ids: Set<number> = new Set(data.assignedProviderIds || []);
        setFlashIds(ids);
        setTimeout(() => setFlashIds(new Set()), 2500);
        // Refresh provider data
        fetchProviders();
      } else if (data.type === 'QUOTA_RESET') {
        setLastUpdate(new Date().toLocaleTimeString());
        fetchProviders();
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      // Auto-reconnect is handled by browser for SSE
    };

    return () => eventSource.close();
  }, [fetchProviders]);

  const totalLeads = providers.reduce((s, p) => s + p.leadsReceived, 0);
  const avgUsage = providers.length
    ? Math.round(providers.reduce((s, p) => s + p.quotaUsedPercent, 0) / providers.length)
    : 0;

  const selectedP = selectedProvider !== null
    ? providers.find((p) => p.id === selectedProvider)
    : null;

  return (
    <main className="grid-bg min-h-screen py-10 px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="font-mono text-xs text-[#4ecca3] mb-2">PROVIDER DASHBOARD</div>
            <h1 className="text-3xl font-light text-[#e8e8f0]">Lead Distribution Monitor</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-full border ${
              connected
                ? 'border-[#22c55e]/40 bg-[#0d1a10] text-[#22c55e]'
                : 'border-[#ef4444]/40 bg-[#1a0d0d] text-[#ef4444]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#22c55e] pulse-dot' : 'bg-[#ef4444]'}`}></span>
              {connected ? 'LIVE' : 'RECONNECTING'}
            </div>
            {lastUpdate && (
              <div className="font-mono text-xs text-[#6b6b8a]">Updated {lastUpdate}</div>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'TOTAL LEADS', value: totalLeads, color: '#6c63ff' },
            { label: 'ACTIVE PROVIDERS', value: providers.length, color: '#4ecca3' },
            { label: 'AVG QUOTA USED', value: `${avgUsage}%`, color: '#f59e0b' },
          ].map((stat) => (
            <div key={stat.label} className="border border-[#1e1e2e] bg-[#0d0d17] rounded-lg p-5">
              <div className="font-mono text-xs text-[#6b6b8a] mb-2">{stat.label}</div>
              <div className="text-3xl font-light" style={{ color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Provider grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border border-[#1e1e2e] bg-[#0d0d17] rounded-lg p-5 animate-pulse h-40" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {providers.map((p) => {
              const isFlashing = flashIds.has(p.id);
              const isSelected = selectedProvider === p.id;
              const barColor = p.quotaUsedPercent >= 90 ? '#ef4444'
                : p.quotaUsedPercent >= 60 ? '#f59e0b' : '#4ecca3';

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(isSelected ? null : p.id)}
                  className={`border rounded-lg p-5 text-left transition-all duration-300 ${
                    isFlashing
                      ? 'border-[#6c63ff] bg-[#0f0f28] shadow-lg shadow-[#6c63ff]/20'
                      : isSelected
                      ? 'border-[#4ecca3]/60 bg-[#0d1a16]'
                      : 'border-[#1e1e2e] bg-[#0d0d17] hover:border-[#2a2a3e]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-[#6b6b8a]">P{p.id}</span>
                    {isFlashing && (
                      <span className="font-mono text-xs text-[#6c63ff] pulse-dot">NEW</span>
                    )}
                  </div>
                  <div className="text-[#e8e8f0] font-medium text-sm mb-4">{p.name}</div>

                  {/* Quota bar */}
                  <div className="mb-3">
                    <div className="flex justify-between font-mono text-xs mb-1.5">
                      <span style={{ color: barColor }}>{p.leadsReceived} leads</span>
                      <span className="text-[#6b6b8a]">{p.remainingQuota} left</span>
                    </div>
                    <div className="w-full bg-[#1e1e2e] rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${p.quotaUsedPercent}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>

                  <div className="font-mono text-xs text-[#6b6b8a]">
                    {p.quotaUsedPercent}% used
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Selected provider detail panel */}
        {selectedP && (
          <div className="border border-[#2a2a3e] bg-[#0d0d17] rounded-lg p-6 slide-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="font-mono text-xs text-[#4ecca3] mb-1">PROVIDER DETAIL</div>
                <h2 className="text-xl font-light text-[#e8e8f0]">{selectedP.name}</h2>
              </div>
              <button
                onClick={() => setSelectedProvider(null)}
                className="font-mono text-xs text-[#6b6b8a] hover:text-[#e8e8f0] border border-[#1e1e2e] px-3 py-1.5 rounded"
              >
                CLOSE
              </button>
            </div>

            {selectedP.assignments.length === 0 ? (
              <div className="text-center py-10 text-[#6b6b8a] font-mono text-sm">
                No leads assigned yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="text-left text-[#6b6b8a] border-b border-[#1e1e2e]">
                      <th className="pb-3 pr-6">LEAD ID</th>
                      <th className="pb-3 pr-6">NAME</th>
                      <th className="pb-3 pr-6">SERVICE</th>
                      <th className="pb-3 pr-6">CITY</th>
                      <th className="pb-3">ASSIGNED AT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedP.assignments.map((a) => (
                      <tr key={a.leadId} className="border-b border-[#1e1e2e]/50">
                        <td className="py-3 pr-6 text-[#6c63ff]">#{a.leadId}</td>
                        <td className="py-3 pr-6 text-[#e8e8f0]">{a.leadName}</td>
                        <td className="py-3 pr-6 text-[#4ecca3]">{a.service}</td>
                        <td className="py-3 pr-6 text-[#9898b8]">{a.city}</td>
                        <td className="py-3 text-[#6b6b8a]">
                          {new Date(a.assignedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* All leads recently assigned - compact view */}
        {!selectedP && !loading && (
          <div className="border border-[#1e1e2e] bg-[#0d0d17] rounded-lg p-6">
            <div className="font-mono text-xs text-[#6b6b8a] mb-4">CLICK A PROVIDER CARD TO VIEW THEIR ASSIGNED LEADS</div>
            <div className="text-[#3a3a5c] font-mono text-sm text-center py-6">
              Select any provider above to drill into their lead assignments.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
