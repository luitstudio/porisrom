import { IsIn, IsInt, IsString, IsUUID, MaxLength, Min, MinLength } from "class-validator";

export class CaptureLeaseReferenceDto {
  @IsUUID()
  leaseId!: string;

  @IsInt()
  @Min(1)
  generation!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

export class CaptureOutcomeDto extends CaptureLeaseReferenceDto {
  @IsIn(["succeeded", "failed", "uncertain"])
  outcome!: "succeeded" | "failed" | "uncertain";
}
