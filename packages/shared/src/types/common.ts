export interface ApiListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EntitySummary {
  id: string;
  createdAt: string;
  updatedAt?: string;
}
