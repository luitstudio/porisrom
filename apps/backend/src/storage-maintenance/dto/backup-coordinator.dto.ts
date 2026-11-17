import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from "class-validator";
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

export class BackupCoordinatorDeliveryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) limit?: number;
}
