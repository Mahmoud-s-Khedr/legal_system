import type { ApiListResponse } from "../types/common";

export interface GovernorateLookupDto {
  key: string;
  labelAr: string;
  labelEn: string;
  labelFr: string;
  value: string;
}

export interface CityLookupDto {
  governorateKey: string;
  key: string;
  labelAr: string;
  labelEn: string;
  labelFr: string;
  value: string;
}

export type GovernorateLookupListResponseDto = ApiListResponse<GovernorateLookupDto>;
export type CityLookupListResponseDto = ApiListResponse<CityLookupDto>;
