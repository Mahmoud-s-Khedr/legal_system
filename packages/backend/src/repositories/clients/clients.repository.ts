import { Language, type Client, type Prisma } from "@prisma/client";
import type { ClientType, CreateClientDto, UpdateClientDto } from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import type { RepositoryTx } from "../types.js";
import { buildFuzzySearchCandidates } from "../../utils/fuzzySearch.js";

const clientInclude = {
  contacts: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true
    }
  },
  _count: {
    select: {
      parties: true,
      invoices: true,
      documents: true
    }
  }
} as const;

export type ClientRecord = Prisma.ClientGetPayload<{ include: typeof clientInclude }>;

export type ClientListQuery = {
  q?: string;
  type?: string;
  sortBy: "name" | "email" | "createdAt" | "updatedAt" | "type";
  sortDir: Prisma.SortOrder;
  page: number;
  limit: number;
};

function contactCreateMany(
  contacts: CreateClientDto["contacts"] | UpdateClientDto["contacts"]
): { data: Array<{ name: string; phone: string; email?: string | null; role?: string | null }> } | undefined {
  if (!contacts?.length) {
    return undefined;
  }

  return {
    data: contacts.map((contact) => ({
      name: contact.name,
      phone: contact.phone,
      email: contact.email ?? null,
      role: contact.role ?? null
    }))
  };
}

export async function listFirmClients(
  tx: RepositoryTx,
  firmId: string,
  query: ClientListQuery
): Promise<{ total: number; items: ClientRecord[] }> {
  const q = query.q?.trim();
  const searchCandidates = buildFuzzySearchCandidates(q);
  const where: Prisma.ClientWhereInput = {
    firmId,
    deletedAt: null,
    ...(searchCandidates.length > 0
      ? {
          OR: searchCandidates.flatMap((candidate) => [
            { name: { contains: candidate, mode: "insensitive" as const } },
            { email: { contains: candidate, mode: "insensitive" as const } }
          ])
        }
      : {}),
    ...(query.type ? { type: query.type as ClientType } : {})
  };

  const [total, items] = await Promise.all([
    tx.client.count({ where }),
    tx.client.findMany({
      where,
      include: clientInclude,
      orderBy: { [query.sortBy]: query.sortDir },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    })
  ]);

  return { total, items };
}

export async function getFirmClientByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  clientId: string
): Promise<ClientRecord> {
  return tx.client.findFirstOrThrow({
    where: {
      id: clientId,
      firmId,
      deletedAt: null
    },
    include: clientInclude
  });
}

export async function getFirmClientRowByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  clientId: string
): Promise<Client> {
  return tx.client.findFirstOrThrow({
    where: {
      id: clientId,
      firmId,
      deletedAt: null
    }
  });
}

export async function createFirmClient(
  tx: RepositoryTx,
  firmId: string,
  payload: CreateClientDto
): Promise<ClientRecord> {
  const contacts = contactCreateMany(payload.contacts);

  return tx.client.create({
    data: {
      firmId,
      name: payload.name,
      type: payload.type,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      governorate: payload.governorate ?? null,
      preferredLanguage: (payload.preferredLanguage as Language | undefined) ?? Language.AR,
      nationalId: payload.nationalId ?? null,
      commercialRegister: payload.commercialRegister ?? null,
      taxNumber: payload.taxNumber ?? null,
      poaNumber: payload.poaNumber ?? null,
      contacts: contacts
        ? {
            createMany: contacts
          }
        : undefined
    },
    include: clientInclude
  });
}

export async function replaceClientContacts(
  tx: RepositoryTx,
  clientId: string,
  contacts: UpdateClientDto["contacts"]
): Promise<void> {
  await tx.clientContact.deleteMany({ where: { clientId } });
  const contactData = contactCreateMany(contacts);
  if (!contactData) {
    return;
  }

  await tx.clientContact.createMany({
    data: contactData.data.map((contact) => ({
      clientId,
      ...contact
    }))
  });
}

export async function updateFirmClientById(
  tx: RepositoryTx,
  clientId: string,
  payload: UpdateClientDto
): Promise<ClientRecord> {
  return tx.client.update({
    where: { id: clientId },
    data: {
      name: payload.name,
      type: payload.type,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      governorate: payload.governorate ?? null,
      preferredLanguage: (payload.preferredLanguage as Language | undefined) ?? Language.AR,
      nationalId: payload.nationalId ?? null,
      commercialRegister: payload.commercialRegister ?? null,
      taxNumber: payload.taxNumber ?? null,
      poaNumber: payload.poaNumber ?? null
    },
    include: clientInclude
  });
}

export async function softDeleteClientById(tx: RepositoryTx, clientId: string): Promise<void> {
  await tx.client.update({
    where: { id: clientId },
    data: { deletedAt: new Date() }
  });
}

export async function findPotentialConflictParties(
  firmId: string,
  name: string,
  nationalId?: string | null
): Promise<Array<{ name: string; case: { id: string; title: string } }>> {
  return prisma.caseParty.findMany({
    where: {
      case: { firmId, deletedAt: null },
      partyType: "OPPONENT",
      OR: [
        { name: { contains: name, mode: "insensitive" } },
        ...(nationalId ? [{ client: { nationalId } }] : [])
      ]
    },
    select: {
      name: true,
      case: { select: { id: true, title: true } }
    },
    take: 10
  });
}

export async function listClientCaseParties(
  tx: RepositoryTx,
  firmId: string,
  clientId: string
): Promise<Array<{ case: { id: string; title: string; caseNumber: string; status: string } }>> {
  return tx.caseParty.findMany({
    where: {
      clientId,
      partyType: "CLIENT",
      case: { firmId, deletedAt: null }
    },
    select: {
      case: {
        select: {
          id: true,
          title: true,
          caseNumber: true,
          status: true
        }
      }
    },
    orderBy: { case: { updatedAt: "desc" } }
  });
}
