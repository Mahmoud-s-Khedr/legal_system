import type {
  CityLookupListResponseDto,
  GovernorateLookupListResponseDto,
  SessionUser
} from "@elms/shared";
import { prisma } from "../../db/prisma.js";

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export async function listGovernorates(_actor: SessionUser): Promise<GovernorateLookupListResponseDto> {
  const items = await prisma.governorateLookup.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { labelAr: "asc" }]
  });

  return {
    items: items.map((row) => ({
      key: row.key,
      labelAr: row.labelAr,
      labelEn: row.labelEn,
      labelFr: row.labelFr,
      value: row.labelAr
    })),
    total: items.length,
    page: 1,
    pageSize: items.length
  };
}

export async function listCitiesByGovernorate(
  _actor: SessionUser,
  governorateValue: string
): Promise<CityLookupListResponseDto> {
  const governorates = await prisma.governorateLookup.findMany({
    where: { isActive: true },
    select: { id: true, key: true, labelAr: true }
  });
  const normalizedGovernorate = normalize(governorateValue);
  const governorate = governorates.find(
    (row) => normalize(row.key) === normalizedGovernorate || normalize(row.labelAr) === normalizedGovernorate
  );

  if (!governorate) {
    return { items: [], total: 0, page: 1, pageSize: 0 };
  }

  const cities = await prisma.cityLookup.findMany({
    where: { governorateId: governorate.id, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { labelAr: "asc" }]
  });

  return {
    items: cities.map((row) => ({
      governorateKey: governorate.key,
      key: row.key,
      labelAr: row.labelAr,
      labelEn: row.labelEn,
      labelFr: row.labelFr,
      value: row.labelAr
    })),
    total: cities.length,
    page: 1,
    pageSize: cities.length
  };
}

export async function validateGovernorateCityPair(
  governorate: string | null | undefined,
  city: string | null | undefined
): Promise<boolean> {
  const normalizedGovernorate = normalize(governorate);
  const normalizedCity = normalize(city);

  if (!normalizedCity) {
    return true;
  }
  if (!normalizedGovernorate) {
    return false;
  }

  const governorates = await prisma.governorateLookup.findMany({
    where: { isActive: true },
    select: { id: true, key: true, labelAr: true }
  });
  const governorateRow = governorates.find(
    (row) => normalize(row.key) === normalizedGovernorate || normalize(row.labelAr) === normalizedGovernorate
  );
  if (!governorateRow) {
    return false;
  }

  const cityRow = await prisma.cityLookup.findFirst({
    where: {
      governorateId: governorateRow.id,
      isActive: true,
      OR: [{ key: { equals: city ?? "", mode: "insensitive" } }, { labelAr: city ?? "" }]
    }
  });

  return Boolean(cityRow);
}
