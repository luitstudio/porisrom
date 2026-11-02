import { Transform } from "class-transformer";
import { IsIn, IsInt, IsString, MaxLength, Min, MinLength } from "class-validator";

export class ResolvePaymentDisputeDto {
  @IsIn(["reopen_claims", "complete"])
  outcome!: "reopen_claims" | "complete";

  @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;

  @IsInt()
  @Min(3)
  expectedMismatchCount!: number;
}
