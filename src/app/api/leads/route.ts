import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allocateProvidersForLead } from '@/lib/allocation';
import { broadcastLeadUpdate } from '@/lib/sse';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, city, serviceId, description } = body;

    // Basic validation
    if (!name || !phone || !city || !serviceId || !description) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const parsedServiceId = parseInt(serviceId, 10);
    if (isNaN(parsedServiceId)) {
      return NextResponse.json({ error: 'Invalid service ID' }, { status: 400 });
    }

    // Verify service exists
    const service = await prisma.service.findUnique({
      where: { id: parsedServiceId },
    });
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Create lead (duplicate check enforced by DB unique constraint)
    let lead;
    try {
      lead = await prisma.lead.create({
        data: {
          name: name.trim(),
          phone: phone.trim(),
          city: city.trim(),
          description: description.trim(),
          serviceId: parsedServiceId,
        },
        include: { service: true },
      });
    } catch (err: any) {
      // Prisma unique constraint violation code
      if (err.code === 'P2002') {
        return NextResponse.json(
          {
            error: `This phone number already has an active lead for ${service.name}. Duplicate leads are not allowed.`,
          },
          { status: 409 }
        );
      }
      throw err;
    }

    // Allocate providers (this is concurrency-safe via DB transaction)
    let assignedProviderIds: number[];
    try {
      assignedProviderIds = await allocateProvidersForLead(lead.id, parsedServiceId);
    } catch (allocationErr: any) {
      // If allocation fails, we still keep the lead but flag the error
      console.error('Allocation error:', allocationErr);
      return NextResponse.json(
        {
          error: allocationErr.message || 'Provider allocation failed',
          leadId: lead.id,
        },
        { status: 422 }
      );
    }

    // Fetch full lead with assignments for response
    const fullLead = await prisma.lead.findUnique({
      where: { id: lead.id },
      include: {
        service: true,
        assignments: {
          include: { provider: true },
        },
      },
    });

    // Broadcast real-time update to all connected dashboard clients
    broadcastLeadUpdate({
      type: 'NEW_LEAD',
      lead: fullLead,
      assignedProviderIds,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        lead: fullLead,
        assignedProviders: assignedProviderIds,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create lead error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        service: true,
        assignments: {
          include: { provider: true },
          orderBy: { assignedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ leads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
