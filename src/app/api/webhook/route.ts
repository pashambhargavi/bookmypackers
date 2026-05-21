import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { broadcastLeadUpdate } from '@/lib/sse';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, eventType, payload } = body;

    // Validate required fields
    if (!eventId || !eventType) {
      return NextResponse.json(
        { error: 'eventId and eventType are required' },
        { status: 400 }
      );
    }

    // IDEMPOTENCY CHECK: If we've already processed this event, return cached result
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: `Event ${eventId} already processed at ${existingEvent.processedAt.toISOString()}`,
        processedAt: existingEvent.processedAt,
      });
    }

    // Process the webhook event based on type
    let result: any = {};

    if (eventType === 'PAYMENT_SUCCESS' || eventType === 'QUOTA_RESET') {
      // Reset ALL providers' quotas to 10 and reset allocation state
      const updatedProviders = await prisma.$transaction(async (tx) => {
        // Reset all provider quotas
        await tx.provider.updateMany({
          data: {
            monthlyQuota: 10,
            leadsReceived: 0,
          },
        });

        // Reset all allocation state indexes (restart round-robin from beginning)
        const states = await tx.allocationState.findMany();
        for (const state of states) {
          const stateData = JSON.parse(state.stateJson);
          await tx.allocationState.update({
            where: { id: state.id },
            data: {
              stateJson: JSON.stringify({ ...stateData, poolIndex: 0 }),
            },
          });
        }

        // Record the webhook event for idempotency
        await tx.webhookEvent.create({
          data: {
            eventId,
            eventType,
            payload: JSON.stringify(payload || {}),
          },
        });

        return await tx.provider.findMany({ orderBy: { id: 'asc' } });
      });

      result = {
        action: 'QUOTA_RESET',
        providersReset: updatedProviders.length,
        providers: updatedProviders.map((p) => ({
          id: p.id,
          name: p.name,
          monthlyQuota: p.monthlyQuota,
          leadsReceived: p.leadsReceived,
        })),
      };

      // Broadcast quota reset to all dashboard clients
      broadcastLeadUpdate({
        type: 'QUOTA_RESET',
        timestamp: new Date().toISOString(),
        providers: result.providers,
      });
    } else {
      return NextResponse.json(
        { error: `Unknown event type: ${eventType}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      idempotent: false,
      message: 'Webhook processed successfully',
      result,
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}
