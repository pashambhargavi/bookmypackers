const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.webhookEvent.deleteMany();
  await prisma.leadAssignment.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.allocationState.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.service.deleteMany();

  // Seed Services
  const service1 = await prisma.service.create({ data: { name: 'Service 1' } });
  const service2 = await prisma.service.create({ data: { name: 'Service 2' } });
  const service3 = await prisma.service.create({ data: { name: 'Service 3' } });

  console.log('✅ Services created');

  // Seed 8 Providers
  const providers = [];
  for (let i = 1; i <= 8; i++) {
    const p = await prisma.provider.create({
      data: {
        name: `Provider ${i}`,
        monthlyQuota: 10,
        leadsReceived: 0,
        allocationIndex: 0,
      },
    });
    providers.push(p);
  }

  console.log('✅ Providers created');

  // Seed AllocationState for each service
  // Service 1 pool: Providers 2, 3, 4 (ids 2,3,4) - mandatory: Provider 1
  // Service 2 pool: Providers 6, 7, 8 (ids 6,7,8) - mandatory: Provider 5
  // Service 3 pool: Providers 2, 3, 5, 6, 7, 8 (ids 2,3,5,6,7,8) - mandatory: Provider 1, 4

  await prisma.allocationState.create({
    data: {
      serviceId: service1.id,
      stateJson: JSON.stringify({ poolIndex: 0, pool: [2, 3, 4] }),
    },
  });

  await prisma.allocationState.create({
    data: {
      serviceId: service2.id,
      stateJson: JSON.stringify({ poolIndex: 0, pool: [6, 7, 8] }),
    },
  });

  await prisma.allocationState.create({
    data: {
      serviceId: service3.id,
      stateJson: JSON.stringify({ poolIndex: 0, pool: [2, 3, 5, 6, 7, 8] }),
    },
  });

  console.log('✅ Allocation states created');
  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
