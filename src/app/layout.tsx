import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prowider — Lead Distribution System',
  description: 'Mini lead distribution system with fair allocation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0a0a0f] text-[#e8e8f0] font-sans antialiased">
        <nav className="border-b border-[#1e1e2e] bg-[#0d0d17]">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">
            <span className="font-mono text-[#6c63ff] font-semibold tracking-tight text-sm">
              PROWIDER
            </span>
            <div className="flex gap-6 text-xs font-mono text-[#6b6b8a]">
              <a href="/" className="hover:text-[#e8e8f0] transition-colors">HOME</a>
              <a href="/request-service" className="hover:text-[#e8e8f0] transition-colors">REQUEST SERVICE</a>
              <a href="/dashboard" className="hover:text-[#e8e8f0] transition-colors">DASHBOARD</a>
              <a href="/test-tools" className="hover:text-[#e8e8f0] transition-colors">TEST TOOLS</a>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
