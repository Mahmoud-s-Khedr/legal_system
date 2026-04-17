import type {
  ClientType,
  ClientDto,
  ClientListResponseDto,
  ConflictWarningDto,
  CreateClientDto,
  SessionUser,
  UpdateClientDto
} from "@elms/shared";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { normalizeSort, toPrismaSortOrder, type SortDir } from "../../utils/tableQuery.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import {
  createFirmClient,
  findPotentialConflictParties,
  getFirmClientByIdOrThrow,
  getFirmClientRowByIdOrThrow,
  listFirmClients,
  replaceClientContacts,
  softDeleteClientById,
  updateFirmClientById,
  type ClientRecord
} from "../../repositories/clients/clients.repository.js";

function mapClient(client: ClientRecord): ClientDto {
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

  return inTenantTransaction(actor.firmId, async (tx) => {
    const { total, items } = await listFirmClients(tx, actor.firmId, {
      q,
      type: query.type,
      sortBy,
      sortDir,
      page,
      limit
    });

    return { items: items.map(mapClient), total, page, pageSize: limit };
  });
}

export async function getClient(actor: SessionUser, clientId: string): Promise<ClientDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const client = await getFirmClientByIdOrThrow(tx, actor.firmId, clientId);

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
  const parties = await findPotentialConflictParties(firmId, name, nationalId);

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

  const client = await inTenantTransaction(actor.firmId, async (tx) => {
    const client = await createFirmClient(tx, actor.firmId, payload);

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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmClientRowByIdOrThrow(tx, actor.firmId, clientId);

    await replaceClientContacts(tx, clientId, payload.contacts);

    const client = await updateFirmClientById(tx, clientId, payload);

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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmClientRowByIdOrThrow(tx, actor.firmId, clientId);

    await softDeleteClientById(tx, clientId);

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
