import { Type } from "class-transformer";
import { IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateWorkAssignmentDto {
  @MinLength(1)
  title!: string;

  @MinLength(1)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetAmount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}
