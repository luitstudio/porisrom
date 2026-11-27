import { Type } from "class-transformer";
import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Min } from "class-validator";

// Principal and certificate identity are deliberately absent: both come only
// from the trusted mTLS guard and the purpose-specific database role.
export class BackupVerifierEvidenceDto {
  @IsString() canonicalSetId!: string;
  @IsString() captureJobId!: string;
  @IsString() captureRequestId!: string;
  @IsUUID() captureAttemptId!: string;
  @IsUUID() leaseId!: string;
  @Type(() => Number) @IsInt() @Min(1) generation!: number;
  @IsIn(["daily", "weekly", "monthly"]) backupClass!: "daily" | "weekly" | "monthly";
  @Matches(/^[a-fA-F0-9]{64}$/) manifestSha256!: string;
  @IsOptional() @IsString() canonicalStorageKey?: string;
  @IsString() verificationMethod!: string;
  @IsIn(["verified", "failed", "incomplete"]) result!: "verified" | "failed" | "incomplete";
  @IsObject() resultPayload!: Record<string, unknown>;
  @Matches(/^[a-fA-F0-9]{64}$/) evidenceSha256!: string;
  @IsString() idempotencyKey!: string;
  @IsOptional() @IsObject() proof?: Record<string, unknown>;
}
