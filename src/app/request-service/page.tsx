'use client';

import { useState } from 'react';

interface FormState {
  name: string;
  phone: string;
  city: string;
  serviceId: string;
  description: string;
}

interface SubmitResult {
  success: boolean;
  error?: string;
  lead?: any;
  assignedProviders?: number[];
}

export default function RequestServicePage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    city: '',
    serviceId: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, error: data.error || 'Submission failed' });
      } else {
        setResult({ success: true, lead: data.lead, assignedProviders: data.assignedProviders });
        setForm({ name: '', phone: '', city: '', serviceId: '', description: '' });
      }
    } catch {
      setResult({ success: false, error: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const services = [
    { id: '1', label: 'Service 1' },
    { id: '2', label: 'Service 2' },
    { id: '3', label: 'Service 3' },
  ];

  const inputClass =
    'w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded px-4 py-3 text-sm text-[#e8e8f0] placeholder-[#3a3a5c] focus:outline-none focus:border-[#6c63ff] transition-colors font-mono';

  return (
    <main className="grid-bg min-h-screen py-16 px-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-10">
          <div className="font-mono text-[#6c63ff] text-xs mb-3">CUSTOMER PORTAL</div>
          <h1 className="text-3xl font-light text-[#e8e8f0] mb-2">Request a Service</h1>
          <p className="text-[#6b6b8a] text-sm">
            Submit your enquiry and get matched with verified providers instantly.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-[#6b6b8a] mb-2">FULL NAME</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="John Smith"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[#6b6b8a] mb-2">PHONE NUMBER</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="9999999999"
                required
                pattern="[0-9]{10}"
                maxLength={10}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-[#6b6b8a] mb-2">CITY</label>
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Mumbai"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[#6b6b8a] mb-2">SERVICE TYPE</label>
              <select
                name="serviceId"
                value={form.serviceId}
                onChange={handleChange}
                required
                className={inputClass}
              >
                <option value="">Select service...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-[#6b6b8a] mb-2">DESCRIPTION</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe what you need..."
              required
              rows={4}
              className={`${inputClass} resize-none`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#6c63ff] hover:bg-[#5a52e8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono text-sm py-3 px-6 rounded transition-colors"
          >
            {loading ? 'SUBMITTING...' : 'SUBMIT ENQUIRY →'}
          </button>
        </form>

        {/* Result display */}
        {result && (
          <div className={`mt-6 p-5 rounded-lg border slide-in ${
            result.success
              ? 'border-[#22c55e]/30 bg-[#0d1a10]'
              : 'border-[#ef4444]/30 bg-[#1a0d0d]'
          }`}>
            {result.success ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[#22c55e] font-mono text-xs">✓ LEAD SUBMITTED</span>
                </div>
                <div className="space-y-2 font-mono text-xs text-[#9898b8]">
                  <div>Lead ID: <span className="text-[#e8e8f0]">#{result.lead?.id}</span></div>
                  <div>Service: <span className="text-[#e8e8f0]">{result.lead?.service?.name}</span></div>
                  <div>
                    Assigned to:{' '}
                    <span className="text-[#4ecca3]">
                      {result.lead?.assignments?.map((a: any) => a.provider.name).join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="font-mono text-xs text-[#ef4444] mb-1">✗ SUBMISSION FAILED</div>
                <div className="text-sm text-[#9898b8]">{result.error}</div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 border border-[#1e1e2e] rounded p-4 font-mono text-xs text-[#6b6b8a]">
          <span className="text-[#f59e0b]">NOTE:</span> Each phone number can only submit one lead per service type. Duplicate requests will be rejected.
        </div>
      </div>
    </main>
  );
}
