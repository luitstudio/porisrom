import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class BackupCoordinatorReferenceDto {
  @IsUUID() leaseId!: string;
  @Type(() => Number) @IsInt() generation!: number;
  @IsIn(["daily", "weekly", "monthly"]) backupClass!: "daily" | "weekly" | "monthly";
  @IsUUID() attemptId!: string;
}

export class BackupCoordinatorReportDto extends BackupCoordinatorReferenceDto {
  @IsIn(["succeeded", "failed", "uncertain"]) outcome!: "succeeded" | "failed" | "uncertain";
  @IsString() resultIdempotencyKey!: string;
  @IsString() reason!: string;
  @IsOptional() @IsString() resultSetId?: string;
  @IsOptional() @Matches(/^[a-fA-F0-9]{64}$/) resultManifestSha256?: string;
}

// This is a candidate publication descriptor, not verifier evidence. The
// service binds it to the already-recorded coordinator result before writing
// an immutable canonical set.
export class BackupCanonicalPublicationDto extends BackupCoordinatorReferenceDto {
  @Matches(/^[a-fA-F0-9]{64}$/) manifestSha256!: string;
  @Type(() => Number) @IsInt() @Min(1) manifestFormatVersion!: number;
  @Matches(/^backup-canonical\/[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/) canonicalStorageKey!: string;
}

export class BackupCoordinatorDeliveryDto {
  @IsIn(["daily", "weekly", "monthly"]) backupClass!: "daily" | "weekly" | "monthly";
  @IsOptional() @Type(() => Boolean) @IsBoolean() recover?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) limit?: number;
}
