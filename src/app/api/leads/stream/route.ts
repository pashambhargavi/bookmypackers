import { NextRequest } from 'next/server';
import { addSSEClient } from '@/lib/sse';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const clientId = uuidv4();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection acknowledgment
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', clientId })}\n\n`)
      );

      // Register this client for broadcasts
      const remove = addSSEClient({
        id: clientId,
        response: {
          write: (data: string) => {
            try {
              controller.enqueue(encoder.encode(data));
            } catch {
              // Client disconnected
            }
          },
        },
      });

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'PING' })}\n\n`)
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Clean up on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        remove();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
