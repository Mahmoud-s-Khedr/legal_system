import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export async function listCustomReportsByFirm(firmId: string) {
  return prisma.customReport.findMany({
    where: { firmId },
    orderBy: { updatedAt: "desc" }
  });
}

export async function createCustomReportForFirm(data: {
  firmId: string;
  name: string;
  description: string | null;
  reportType: string;
  config: object;
  createdById: string | null;
}) {
  return prisma.customReport.create({
    data
  });
}

export async function findCustomReportByIdForFirm(id: string, firmId: string) {
  return prisma.customReport.findFirst({ where: { id, firmId } });
}

export async function updateCustomReportById(
  id: string,
  data: Prisma.CustomReportUpdateInput
) {
  return prisma.customReport.update({ where: { id }, data });
}

export async function deleteCustomReportById(id: string): Promise<void> {
  await prisma.customReport.delete({ where: { id } });
}
