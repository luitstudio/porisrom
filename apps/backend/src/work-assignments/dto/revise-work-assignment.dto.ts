import { Type } from "class-transformer";
import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

const REVISE_ACTIONS = ["revise", "reject"] as const;
export type ReviseAction = (typeof REVISE_ACTIONS)[number];

export class ReviseWorkAssignmentDto {
  @IsIn(REVISE_ACTIONS)
  action!: ReviseAction;

  @IsOptional()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
