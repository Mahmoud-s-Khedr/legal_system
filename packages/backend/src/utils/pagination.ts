export interface PaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
}

export interface SearchPaginationOptions {
  defaultPage?: number;
  defaultPageSize?: number;
  maxPageSize?: number;
}

export function parsePaginationQuery(
  query: { page?: string; limit?: string },
  options: PaginationOptions = {}
) {
  const {
    defaultPage = 1,
    defaultLimit = 50,
    maxLimit = 200
  } = options;

  const page = Math.max(1, parseInt(query.page ?? String(defaultPage), 10) || defaultPage);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(query.limit ?? String(defaultLimit), 10) || defaultLimit)
  );

  return { page, limit };
}

export function parseSearchPaginationQuery(
  query: { page?: string; pageSize?: string },
  options: SearchPaginationOptions = {}
) {
  const {
    defaultPage = 1,
    defaultPageSize = 20,
    maxPageSize = 100
  } = options;

  const page = Math.max(1, parseInt(query.page ?? String(defaultPage), 10) || defaultPage);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, parseInt(query.pageSize ?? String(defaultPageSize), 10) || defaultPageSize)
  );

  return { page, pageSize };
}

export function paginate(page = 1, pageSize = 25) {
  const safePage = Math.max(page, 1);
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);

  return {
    skip: (safePage - 1) * safePageSize,
    take: safePageSize
  };
}
