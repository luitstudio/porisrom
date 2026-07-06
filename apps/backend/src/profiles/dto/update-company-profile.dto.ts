import { IsArray, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateCompanyProfileDto {
  @MinLength(1)
  companyName!: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  about?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];
}
