// Server-Sent Events broadcaster
// Uses a simple in-memory set of response objects per process
// For multi-process deployments, use Redis pub/sub instead

type SSEClient = {
  id: string;
  response: any;
};

const clients = new Set<SSEClient>();

export function addSSEClient(client: SSEClient) {
  clients.add(client);
  return () => clients.delete(client);
}

export function broadcastLeadUpdate(data: object) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach((client) => {
    try {
      client.response.write(message);
    } catch {
      clients.delete(client);
    }
  });
}

export function getClientCount() {
  return clients.size;
}
