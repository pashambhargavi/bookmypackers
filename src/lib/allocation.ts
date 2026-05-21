import { prisma } from './prisma';

// Mandatory assignment rules
const MANDATORY_ASSIGNMENTS: Record<number, number[]> = {
  1: [1],       // Service 1 → Provider 1
  2: [5],       // Service 2 → Provider 5
  3: [1, 4],    // Service 3 → Provider 1 AND Provider 4
};

const TOTAL_ASSIGNMENTS = 3;

/**
 * Core allocation function. 
 * Uses a database transaction with SELECT FOR UPDATE to ensure concurrency safety.
 * Implements persistent round-robin allocation.
 */
export async function allocateProvidersForLead(
  leadId: number,
  serviceId: number
): Promise<number[]> {
  return await prisma.$transaction(async (tx) => {
    // Lock the allocation state row for this service to prevent race conditions
    const allocationState = await tx.$queryRaw<Array<{
      id: number;
      serviceId: number;
      stateJson: string;
    }>>`
      SELECT id, "serviceId", "stateJson" 
      FROM allocation_states 
      WHERE "serviceId" = ${serviceId}
      FOR UPDATE
    `;

    if (!allocationState.length) {
      throw new Error(`No allocation state found for service ${serviceId}`);
    }

    const state = allocationState[0];
    const stateData: { poolIndex: number; pool: number[] } = JSON.parse(state.stateJson);

    // Get mandatory providers for this service
    const mandatoryProviderIds = MANDATORY_ASSIGNMENTS[serviceId] || [];

    // Fetch providers with their current quota info (lock for update)
    const allProviders = await tx.$queryRaw<Array<{
      id: number;
      name: string;
      monthlyQuota: number;
      leadsReceived: number;
    }>>`
      SELECT id, name, "monthlyQuota", "leadsReceived"
      FROM providers
      WHERE id = ANY(${[...mandatoryProviderIds, ...stateData.pool]}::int[])
      FOR UPDATE
    `;

    const providerMap = new Map(allProviders.map(p => [p.id, p]));

    // Step 1: Assign mandatory providers (skip if quota exceeded)
    const assignedProviderIds: number[] = [];

    for (const mandatoryId of mandatoryProviderIds) {
      const provider = providerMap.get(mandatoryId);
      if (provider && provider.leadsReceived < provider.monthlyQuota) {
        assignedProviderIds.push(mandatoryId);
      }
    }

    // Step 2: Fill remaining slots from pool using round-robin
    const slotsNeeded = TOTAL_ASSIGNMENTS - assignedProviderIds.length;
    let poolIndex = stateData.poolIndex;
    const pool = stateData.pool;
    let attempts = 0;
    const maxAttempts = pool.length * 2; // Prevent infinite loop

    while (assignedProviderIds.length < TOTAL_ASSIGNMENTS && attempts < maxAttempts) {
      const candidateId = pool[poolIndex % pool.length];
      poolIndex = (poolIndex + 1) % pool.length;
      attempts++;

      // Skip if already assigned, quota exceeded, or not in provider map
      if (assignedProviderIds.includes(candidateId)) continue;

      const provider = providerMap.get(candidateId);
      if (!provider || provider.leadsReceived >= provider.monthlyQuota) continue;

      assignedProviderIds.push(candidateId);
    }

    if (assignedProviderIds.length === 0) {
      throw new Error('No providers available for assignment (all quota exceeded)');
    }

    // Step 3: Create lead assignments
    for (const providerId of assignedProviderIds) {
      await tx.leadAssignment.create({
        data: { leadId, providerId },
      });

      // Increment provider's lead count
      await tx.provider.update({
        where: { id: providerId },
        data: { leadsReceived: { increment: 1 } },
      });
    }

    // Step 4: Persist the new pool index for next allocation
    await tx.allocationState.update({
      where: { id: state.id },
      data: {
        stateJson: JSON.stringify({
          poolIndex: poolIndex % pool.length,
          pool: stateData.pool,
        }),
      },
    });

    return assignedProviderIds;
  }, {
    isolationLevel: 'Serializable', // Highest isolation to prevent race conditions
    maxWait: 10000,
    timeout: 15000,
  });
}

export { MANDATORY_ASSIGNMENTS, TOTAL_ASSIGNMENTS };
