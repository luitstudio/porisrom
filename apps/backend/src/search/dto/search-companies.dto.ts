import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

function optionalTrimmedString(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function booleanQueryParam(value: unknown) {
  if (value === undefined || value === "") return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return value;
}

export class SearchCompaniesDto {
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  keyword?: string;

  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  state?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @Transform(({ value }) => booleanQueryParam(value))
  @IsBoolean()
  verifiedOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;
}
