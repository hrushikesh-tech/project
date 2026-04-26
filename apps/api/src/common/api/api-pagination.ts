import type { ApiPaginationMeta } from "./request-context";

type PaginatedLike = {
  pagination?: ApiPaginationMeta;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
};

export function extractPagination(value: unknown): ApiPaginationMeta | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as PaginatedLike;
  if (candidate.pagination) {
    return candidate.pagination;
  }

  if (
    candidate.page !== undefined ||
    candidate.pageSize !== undefined ||
    candidate.total !== undefined ||
    candidate.totalPages !== undefined
  ) {
    return {
      page: candidate.page,
      pageSize: candidate.pageSize,
      total: candidate.total,
      totalPages: candidate.totalPages,
      hasNextPage: candidate.hasNextPage,
      hasPreviousPage: candidate.hasPreviousPage,
    };
  }

  return undefined;
}
