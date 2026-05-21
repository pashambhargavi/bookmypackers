'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface LogEntry {
  ts: string;
  label: string;
  status: 'success' | 'error' | 'info';
  data?: any;
}

export default function TestToolsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const log = (label: string, status: LogEntry['status'], data?: any) => {
    setLogs((prev) => [
      { ts: new Date().toLocaleTimeString(), label, status, data },
      ...prev,
    ]);
  };

  const setActionLoading = (key: string, val: boolean) =>
    setLoading((prev) => ({ ...prev, [key]: val }));

  // Webhook: reset quota (idempotent)
  const callWebhook = async (idempotent: boolean) => {
    const key = 'webhook';
    setActionLoading(key, true);
    // Re-use same eventId to test idempotency if flagged
    const eventId = idempotent
      ? 'test-idempotent-event-001'   // same ID every time → should only process once
      : `evt-${uuidv4()}`;            // unique ID each time → processes each call

    log(
      `Calling webhook [eventId=${eventId.slice(0, 20)}...]`,
      'info'
    );

    try {
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          eventType: 'QUOTA_RESET',
          payload: { source: 'test-panel', triggeredAt: new Date().toISOString() },
        }),
      });
      const data = await res.json();

      if (res.ok) {
        log(
          data.idempotent
            ? `⚡ IDEMPOTENT — already processed (${data.processedAt})`
            : `✓ Quota reset successful — ${data.result?.providersReset} providers updated`,
          data.idempotent ? 'info' : 'success',
          data
        );
      } else {
        log(`✗ Webhook failed: ${data.error}`, 'error', data);
      }
    } catch (err: any) {
      log(`✗ Network error: ${err.message}`, 'error');
    } finally {
      setActionLoading(key, false);
    }
  };

  // Call same webhook ID 3 times rapidly to prove idempotency
  const callWebhookMultiple = async () => {
    const key = 'multi';
    setActionLoading(key, true);
    const sharedEventId = `idempotency-test-${Date.now()}`;
    log(`Sending same eventId 3× rapidly: ${sharedEventId.slice(0, 30)}...`, 'info');

    try {
      const calls = Array.from({ length: 3 }, () =>
        fetch('/api/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: sharedEventId,
            eventType: 'QUOTA_RESET',
            payload: { test: 'idempotency' },
          }),
        }).then((r) => r.json())
      );

      const results = await Promise.all(calls);
      const processed = results.filter((r) => !r.idempotent).length;
      const idempotent = results.filter((r) => r.idempotent).length;

      log(
        `3 calls sent → ${processed} processed, ${idempotent} idempotent (duplicates blocked)`,
        processed <= 1 ? 'success' : 'error',
        results
      );
    } catch (err: any) {
      log(`✗ Error: ${err.message}`, 'error');
    } finally {
      setActionLoading(key, false);
    }
  };

  // Generate 10 concurrent leads
  const generateBulkLeads = async () => {
    const key = 'bulk';
    setActionLoading(key, true);
    log('Generating 10 leads concurrently...', 'info');

    try {
      const res = await fetch('/api/test-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'GENERATE_BULK_LEADS' }),
      });
      const data = await res.json();

      if (res.ok) {
        const success = data.results?.filter((r: any) => r.success).length ?? 0;
        const failed = data.results?.filter((r: any) => !r.success).length ?? 0;
        log(
          `✓ Bulk complete — ${success} created, ${failed} failed`,
          failed === 0 ? 'success' : 'info',
          data.results
        );
      } else {
        log(`✗ Bulk failed: ${data.error}`, 'error');
      }
    } catch (err: any) {
      log(`✗ Error: ${err.message}`, 'error');
    } finally {
      setActionLoading(key, false);
    }
  };

  const clearLogs = () => setLogs([]);

  const btnBase =
    'flex flex-col gap-1 border rounded-lg p-5 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:border-opacity-60';

  return (
    <main className="grid-bg min-h-screen py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <div className="font-mono text-xs text-[#f59e0b] mb-2">ENGINEERING TEST PANEL</div>
          <h1 className="text-3xl font-light text-[#e8e8f0] mb-2">Test Tools</h1>
          <p className="text-[#6b6b8a] text-sm">
            Simulate payment webhooks, test idempotency, and stress-test concurrent lead creation.
          </p>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">

          {/* Reset quota */}
          <button
            onClick={() => callWebhook(false)}
            disabled={loading['webhook']}
            className={`${btnBase} border-[#22c55e]/30 bg-[#0d1a10] hover:border-[#22c55e]/60`}
          >
            <span className="font-mono text-xs text-[#22c55e]">
              {loading['webhook'] ? 'PROCESSING...' : 'WEBHOOK → RESET QUOTA'}
            </span>
            <span className="text-[#9898b8] text-xs">
              Simulates payment success. Resets all provider quotas to 10 and clears lead counts.
            </span>
          </button>

          {/* Idempotency test - same eventId */}
          <button
            onClick={callWebhookMultiple}
            disabled={loading['multi']}
            className={`${btnBase} border-[#6c63ff]/30 bg-[#0f0f1e] hover:border-[#6c63ff]/60`}
          >
            <span className="font-mono text-xs text-[#6c63ff]">
              {loading['multi'] ? 'TESTING...' : 'IDEMPOTENCY TEST (3× SAME ID)'}
            </span>
            <span className="text-[#9898b8] text-xs">
              Fires the same webhook event 3 times simultaneously. Only 1 should process; rest must be blocked.
            </span>
          </button>

          {/* Concurrent lead generation */}
          <button
            onClick={generateBulkLeads}
            disabled={loading['bulk']}
            className={`${btnBase} border-[#f59e0b]/30 bg-[#1a1508] hover:border-[#f59e0b]/60 sm:col-span-2`}
          >
            <span className="font-mono text-xs text-[#f59e0b]">
              {loading['bulk'] ? 'GENERATING...' : 'CONCURRENCY TEST — GENERATE 10 LEADS SIMULTANEOUSLY'}
            </span>
            <span className="text-[#9898b8] text-xs">
              Creates 10 leads concurrently via Promise.all(). Tests allocation correctness under race conditions. Watch the dashboard update in real-time.
            </span>
          </button>
        </div>

        {/* Reference rules */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { service: 'Service 1', mandatory: 'Provider 1', pool: 'P2, P3, P4', color: '#6c63ff' },
            { service: 'Service 2', mandatory: 'Provider 5', pool: 'P6, P7, P8', color: '#4ecca3' },
            { service: 'Service 3', mandatory: 'P1 + P4', pool: 'P2, P3, P5, P6, P7, P8', color: '#f59e0b' },
          ].map((rule) => (
            <div key={rule.service} className="border border-[#1e1e2e] bg-[#0d0d17] rounded-lg p-4 font-mono text-xs">
              <div className="mb-2" style={{ color: rule.color }}>{rule.service}</div>
              <div className="text-[#9898b8]">Mandatory: {rule.mandatory}</div>
              <div className="text-[#6b6b8a]">Pool: {rule.pool}</div>
            </div>
          ))}
        </div>

        {/* Activity log */}
        <div className="border border-[#1e1e2e] bg-[#0a0a0f] rounded-lg">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e1e2e]">
            <span className="font-mono text-xs text-[#6b6b8a]">ACTIVITY LOG</span>
            {logs.length > 0 && (
              <button
                onClick={clearLogs}
                className="font-mono text-xs text-[#6b6b8a] hover:text-[#ef4444] transition-colors"
              >
                CLEAR
              </button>
            )}
          </div>
          <div className="p-5 min-h-48 max-h-96 overflow-y-auto space-y-2 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-[#3a3a5c] text-center py-8">
                No activity yet. Run a test above.
              </div>
            ) : (
              logs.map((entry, i) => (
                <div
                  key={i}
                  className={`flex gap-3 items-start slide-in ${
                    entry.status === 'success'
                      ? 'text-[#22c55e]'
                      : entry.status === 'error'
                      ? 'text-[#ef4444]'
                      : 'text-[#9898b8]'
                  }`}
                >
                  <span className="text-[#3a3a5c] shrink-0">{entry.ts}</span>
                  <span>{entry.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
