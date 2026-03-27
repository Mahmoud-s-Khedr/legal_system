import type {
  ClientType,
  ClientDto,
  ClientListResponseDto,
  ConflictWarningDto,
  CreateClientDto,
  SessionUser,
  UpdateClientDto
} from "@elms/shared";
import { Language } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { normalizeSort, toPrismaSortOrder, type SortDir } from "../../utils/tableQuery.js";

function mapClient(client: {
  id: string;
  name: string;
  type: "INDIVIDUAL" | "COMPANY" | "GOVERNMENT";
  phone: string | null;
  email: string | null;
  governorate: string | null;
  preferredLanguage: string;
  nationalId: string | null;
  commercialRegister: string | null;
  taxNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  contacts: Array<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    role: string | null;
  }>;
  _count: {
    parties: number;
    invoices: number;
    documents: number;
  };
}): ClientDto {
  return {
    id: client.id,
    name: client.name,
    type: client.type as ClientType,
    phone: client.phone,
    email: client.email,
    governorate: client.governorate,
    preferredLanguage: client.preferredLanguage,
    nationalId: client.nationalId,
    commercialRegister: client.commercialRegister,
    taxNumber: client.taxNumber,
    contacts: client.contacts,
    linkedCaseCount: client._count.parties,
    invoiceCount: client._count.invoices,
    documentCount: client._count.documents,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString()
  };
}

function contactCreateMany(
  contacts: CreateClientDto["contacts"]
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

export async function listClients(
  actor: SessionUser,
  searchOrQuery?:
    | string
    | {
        q?: string;
        search?: string;
        type?: string;
        sortBy?: string;
        sortDir?: SortDir;
        page?: number;
        limit?: number;
      },
  pagination: { page: number; limit: number } = { page: 1, limit: 50 }
): Promise<ClientListResponseDto> {
  const query = typeof searchOrQuery === "string" ? { q: searchOrQuery } : (searchOrQuery ?? {});
  const q = (query.q ?? query.search)?.trim();
  const page = query.page ?? pagination.page;
  const limit = query.limit ?? pagination.limit;
  const sortBy = normalizeSort(query.sortBy, ["name", "email", "createdAt", "updatedAt", "type"] as const, "createdAt");
  const sortDir = toPrismaSortOrder(query.sortDir ?? "desc");

  return withTenant(prisma, actor.firmId, async (tx) => {
    const where = {
      firmId: actor.firmId,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } }
            ]
          }
        : {}),
      ...(query.type ? { type: query.type as ClientType } : {})
    };

    const [total, clients] = await Promise.all([
      tx.client.count({ where }),
      tx.client.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          phone: true,
          email: true,
          governorate: true,
          preferredLanguage: true,
          nationalId: true,
          commercialRegister: true,
          taxNumber: true,
          createdAt: true,
          updatedAt: true,
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
            select: { parties: true, invoices: true, documents: true }
          }
        },
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return { items: clients.map(mapClient), total, page, pageSize: limit };
  });
}

export async function getClient(actor: SessionUser, clientId: string): Promise<ClientDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const client = await tx.client.findFirstOrThrow({
      where: {
        id: clientId,
        firmId: actor.firmId,
        deletedAt: null
      },
      include: {
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
      }
    });

    return mapClient(client);
  });
}

/**
 * Check whether a new client intake would create a conflict of interest.
 * A conflict exists when the prospective client's name or nationalId matches
 * an existing opposing party in any active case.
 */
export async function checkClientConflictOnIntake(
  firmId: string,
  name: string,
  nationalId?: string | null
): Promise<ConflictWarningDto[]> {
  const parties = await prisma.caseParty.findMany({
    where: {
      case: { firmId, deletedAt: null },
      isOurClient: false,
      OR: [
        { name: { contains: name, mode: "insensitive" } },
        ...(nationalId
          ? [{ client: { nationalId } }]
          : [])
      ]
    },
    select: {
      name: true,
      case: { select: { id: true, title: true } }
    },
    take: 10
  });

  return parties.map((p) => ({
    name: p.name,
    conflictingCaseId: p.case.id,
    conflictingCaseTitle: p.case.title
  }));
}

export async function createClient(
  actor: SessionUser,
  payload: CreateClientDto,
  audit: AuditContext
): Promise<{ client: ClientDto; conflictWarnings: ConflictWarningDto[] }> {
  const conflictWarnings = await checkClientConflictOnIntake(
    actor.firmId,
    payload.name,
    payload.nationalId
  );

  const client = await withTenant(prisma, actor.firmId, async (tx) => {
    const contacts = contactCreateMany(payload.contacts);

    const client = await tx.client.create({
      data: {
        firmId: actor.firmId,
        name: payload.name,
        type: payload.type,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
        governorate: payload.governorate ?? null,
        preferredLanguage: (payload.preferredLanguage as Language | undefined) ?? Language.AR,
        nationalId: payload.nationalId ?? null,
        commercialRegister: payload.commercialRegister ?? null,
        taxNumber: payload.taxNumber ?? null,
        contacts: contacts
          ? {
              createMany: contacts
            }
          : undefined
      },
      include: {
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
      }
    });

    await writeAuditLog(tx, audit, {
      action: "clients.create",
      entityType: "Client",
      entityId: client.id,
      newData: {
        name: client.name,
        type: client.type
      }
    });

    return mapClient(client);
  });

  return { client, conflictWarnings };
}

export async function updateClient(
  actor: SessionUser,
  clientId: string,
  payload: UpdateClientDto,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const contacts = contactCreateMany(payload.contacts);

    const existing = await tx.client.findFirstOrThrow({
      where: {
        id: clientId,
        firmId: actor.firmId,
        deletedAt: null
      }
    });

    await tx.clientContact.deleteMany({
      where: {
        clientId
      }
    });

    const client = await tx.client.update({
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
        contacts: contacts
          ? {
              createMany: contacts
            }
          : undefined
      },
      include: {
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
      }
    });

    await writeAuditLog(tx, audit, {
      action: "clients.update",
      entityType: "Client",
      entityId: client.id,
      oldData: {
        name: existing.name,
        type: existing.type
      },
      newData: {
        name: client.name,
        type: client.type
      }
    });

    return mapClient(client);
  });
}

export async function removeClient(
  actor: SessionUser,
  clientId: string,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.client.findFirstOrThrow({
      where: {
        id: clientId,
        firmId: actor.firmId,
        deletedAt: null
      }
    });

    await tx.client.update({
      where: {
        id: clientId
      },
      data: {
        deletedAt: new Date()
      }
    });

    await writeAuditLog(tx, audit, {
      action: "clients.delete",
      entityType: "Client",
      entityId: clientId,
      oldData: {
        name: existing.name
      }
    });

    return { success: true as const };
  });
}
