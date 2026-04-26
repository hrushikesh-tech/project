import { plainToInstance } from "class-transformer";
import { IsOptional, Matches, validateSync } from "class-validator";

const TENANT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/;

export class TenantIdHeaderDto {
  @IsOptional()
  @Matches(TENANT_ID_PATTERN, {
    message: "x-tenant-id must contain only letters, numbers, hyphens, or underscores.",
  })
  tenantId?: string;
}

export function normalizeTenantIdHeader(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (typeof rawValue !== "string") {
    return undefined;
  }

  const tenantId = rawValue.trim();
  if (!tenantId) {
    return undefined;
  }

  const dto = plainToInstance(TenantIdHeaderDto, { tenantId });
  const errors = validateSync(dto);
  if (errors.length > 0) {
    throw new Error(errors[0]?.constraints?.matches ?? "Invalid x-tenant-id header.");
  }

  return dto.tenantId;
}
