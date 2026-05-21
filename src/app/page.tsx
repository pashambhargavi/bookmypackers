import Link from 'next/link';

export default function Home() {
  return (
    <main className="grid-bg min-h-screen flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-2xl w-full text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#1e1e2e] bg-[#0d0d17] text-[#6c63ff] font-mono text-xs mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6c63ff] pulse-dot"></span>
          LEAD DISTRIBUTION ENGINE v1.0
        </div>

        <h1 className="text-5xl font-light text-[#e8e8f0] mb-4 tracking-tight">
          Prowider
          <span className="text-[#6c63ff]">.</span>
        </h1>
        <p className="text-[#6b6b8a] font-mono text-sm mb-12 leading-relaxed">
          Fair lead allocation system with real-time distribution,<br />
          concurrency-safe round-robin, and quota management.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/request-service" className="group border border-[#1e1e2e] bg-[#0d0d17] hover:border-[#6c63ff] hover:bg-[#0f0f1e] p-6 rounded-lg transition-all text-left">
            <div className="text-[#6c63ff] font-mono text-xs mb-3">01</div>
            <div className="text-[#e8e8f0] font-medium mb-1">Request Service</div>
            <div className="text-[#6b6b8a] text-xs">Submit a new lead enquiry</div>
          </Link>

          <Link href="/dashboard" className="group border border-[#1e1e2e] bg-[#0d0d17] hover:border-[#4ecca3] hover:bg-[#0d1a16] p-6 rounded-lg transition-all text-left">
            <div className="text-[#4ecca3] font-mono text-xs mb-3">02</div>
            <div className="text-[#e8e8f0] font-medium mb-1">Live Dashboard</div>
            <div className="text-[#6b6b8a] text-xs">Real-time provider view</div>
          </Link>

          <Link href="/test-tools" className="group border border-[#1e1e2e] bg-[#0d0d17] hover:border-[#f59e0b] hover:bg-[#1a1508] p-6 rounded-lg transition-all text-left">
            <div className="text-[#f59e0b] font-mono text-xs mb-3">03</div>
            <div className="text-[#e8e8f0] font-medium mb-1">Test Tools</div>
            <div className="text-[#6b6b8a] text-xs">Webhook & concurrency testing</div>
          </Link>
        </div>

        <div className="mt-12 border border-[#1e1e2e] rounded-lg p-6 text-left bg-[#0d0d17]">
          <div className="font-mono text-xs text-[#6b6b8a] mb-4">SYSTEM RULES</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <div className="text-[#4ecca3] mb-2">Service 1</div>
              <div className="text-[#9898b8]">Mandatory: P1</div>
              <div className="text-[#6b6b8a]">Pool: P2, P3, P4</div>
            </div>
            <div>
              <div className="text-[#4ecca3] mb-2">Service 2</div>
              <div className="text-[#9898b8]">Mandatory: P5</div>
              <div className="text-[#6b6b8a]">Pool: P6, P7, P8</div>
            </div>
            <div>
              <div className="text-[#4ecca3] mb-2">Service 3</div>
              <div className="text-[#9898b8]">Mandatory: P1, P4</div>
              <div className="text-[#6b6b8a]">Pool: P2, P3, P5, P6, P7, P8</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
