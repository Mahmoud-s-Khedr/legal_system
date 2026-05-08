import type { PrismaClient } from "@prisma/client";
import { EGYPT_CITIES, EGYPT_GOVERNORATES } from "./egyptLocations.data.js";

export async function ensureEgyptLocationLookups(prisma: PrismaClient) {
  for (const governorate of EGYPT_GOVERNORATES) {
    await prisma.governorateLookup.upsert({
      where: { key: governorate.key },
      update: {
        labelAr: governorate.labelAr,
        labelEn: governorate.labelEn,
        labelFr: governorate.labelFr,
        isActive: true,
        sortOrder: governorate.sortOrder
      },
      create: {
        key: governorate.key,
        labelAr: governorate.labelAr,
        labelEn: governorate.labelEn,
        labelFr: governorate.labelFr,
        isActive: true,
        sortOrder: governorate.sortOrder
      }
    });
  }

  const governorates = await prisma.governorateLookup.findMany({ select: { id: true, key: true } });
  const governorateIdByKey = new Map(governorates.map((row) => [row.key, row.id]));

  for (const [index, city] of EGYPT_CITIES.entries()) {
    const governorateId = governorateIdByKey.get(city.governorateKey);
    if (!governorateId) continue;

    await prisma.cityLookup.upsert({
      where: {
        governorateId_key: {
          governorateId,
          key: city.key
        }
      },
      update: {
        labelAr: city.labelAr,
        labelEn: city.labelEn,
        labelFr: city.labelFr,
        isActive: true,
        sortOrder: index
      },
      create: {
        governorateId,
        key: city.key,
        labelAr: city.labelAr,
        labelEn: city.labelEn,
        labelFr: city.labelFr,
        isActive: true,
        sortOrder: index
      }
    });
  }
}
