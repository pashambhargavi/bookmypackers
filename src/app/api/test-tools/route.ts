import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allocateProvidersForLead } from '@/lib/allocation';
import { broadcastLeadUpdate } from '@/lib/sse';
import { v4 as uuidv4 } from 'uuid';

// Generate 10 concurrent leads to test concurrency handling
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'GENERATE_BULK_LEADS') {
      // Generate 10 leads concurrently across different services
      const services = await prisma.service.findMany();
      if (services.length === 0) {
        return NextResponse.json({ error: 'No services found' }, { status: 400 });
      }

      const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad'];
      const names = ['Rahul Sharma', 'Priya Singh', 'Amit Kumar', 'Neha Gupta', 'Vikram Mehta', 
                     'Anjali Patel', 'Suresh Rao', 'Kavya Nair', 'Arjun Das', 'Meera Iyer'];

      // Create 10 unique leads concurrently
      const leadPromises = Array.from({ length: 10 }, async (_, i) => {
        const service = services[i % services.length];
        const phone = `9${String(Math.floor(100000000 + Math.random() * 900000000))}`;
        const uniqueId = uuidv4().slice(0, 8);

        try {
          const lead = await prisma.lead.create({
            data: {
              name: names[i],
              phone: `${phone}${uniqueId.slice(0, 2)}`.slice(0, 10),
              city: cities[i % cities.length],
              description: `Auto-generated test lead #${i + 1} for concurrency testing`,
              serviceId: service.id,
            },
          });

          const assignedIds = await allocateProvidersForLead(lead.id, service.id);

          const fullLead = await prisma.lead.findUnique({
            where: { id: lead.id },
            include: { service: true, assignments: { include: { provider: true } } },
          });

          broadcastLeadUpdate({
            type: 'NEW_LEAD',
            lead: fullLead,
            assignedProviderIds: assignedIds,
            timestamp: new Date().toISOString(),
          });

          return { success: true, leadId: lead.id, assignedProviders: assignedIds };
        } catch (err: any) {
          return { success: false, error: err.message, index: i };
        }
      });

      const results = await Promise.allSettled(leadPromises);
      const settled = results.map((r) =>
        r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' }
      );

      const successCount = settled.filter((r: any) => r.success).length;

      return NextResponse.json({
        success: true,
        message: `Generated ${successCount}/10 leads successfully`,
        results: settled,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Test tools error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
