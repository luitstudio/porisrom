import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

function optionalQueryNumber(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

export class LeaderboardQueryDto {
  @IsOptional()
  @Transform(({ value }) => optionalQueryNumber(value))
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minRatingCount?: number;
}
