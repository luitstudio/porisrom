import { IsIn, IsOptional } from "class-validator";
import type { Role } from "@porisrom/database";

export const ADMIN_USER_ROLE_FILTERS = ["admin", "client", "freelancer"] as const satisfies readonly Role[];

export class ListUsersQueryDto {
  @IsOptional()
  @IsIn(ADMIN_USER_ROLE_FILTERS)
  role?: Role;
}
