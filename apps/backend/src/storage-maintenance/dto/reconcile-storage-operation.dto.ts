import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class ReconcileStorageOperationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;

  @IsIn(["confirmed_complete", "confirmed_not_started", "provider_reconciled"])
  outcome!: "confirmed_complete" | "confirmed_not_started" | "provider_reconciled";
}
