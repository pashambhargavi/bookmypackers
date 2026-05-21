import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: { id: 'asc' },
      include: {
        leadAssignments: {
          include: {
            lead: {
              include: { service: true },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    const formatted = providers.map((p) => ({
      id: p.id,
      name: p.name,
      monthlyQuota: p.monthlyQuota,
      leadsReceived: p.leadsReceived,
      remainingQuota: Math.max(0, p.monthlyQuota - p.leadsReceived),
      quotaUsedPercent: Math.round((p.leadsReceived / p.monthlyQuota) * 100),
      assignments: p.leadAssignments.map((a) => ({
        leadId: a.leadId,
        leadName: a.lead.name,
        service: a.lead.service.name,
        city: a.lead.city,
        phone: a.lead.phone,
        assignedAt: a.assignedAt,
      })),
    }));

    return NextResponse.json({ providers: formatted });
  } catch (error: any) {
    console.error('Get providers error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
