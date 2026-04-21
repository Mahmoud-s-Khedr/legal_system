import { ClientType } from "../enums/index";
import type { ApiListResponse } from "../types/common";

export interface ClientContactDto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string | null;
}

export interface ClientDto {
  id: string;
  name: string;
  type: ClientType;
  phone: string | null;
  email: string | null;
  governorate: string | null;
  preferredLanguage: string;
  nationalId: string | null;
  commercialRegister: string | null;
  taxNumber: string | null;
  poaNumber: string | null;
  contacts: ClientContactDto[];
  linkedCaseCount: number;
  invoiceCount: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientDto {
  name: string;
  type: ClientType;
  phone?: string | null;
  email?: string | null;
  governorate?: string | null;
  preferredLanguage?: string;
  nationalId?: string | null;
  commercialRegister?: string | null;
  taxNumber?: string | null;
  poaNumber?: string | null;
  contacts?: Array<{
    name: string;
    phone: string;
    email?: string | null;
    role?: string | null;
  }>;
}

export type UpdateClientDto = CreateClientDto;

export type ClientListResponseDto = ApiListResponse<ClientDto>;

