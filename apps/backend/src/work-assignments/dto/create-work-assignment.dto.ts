import { Type } from "class-transformer";
import { IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength, Validate } from "class-validator";

import { IsDueDateAtLeastTomorrowConstraint, MIN_WORK_ASSIGNMENT_BUDGET } from "./work-assignment-terms";

export class CreateWorkAssignmentDto {
  @MinLength(1)
  title!: string;

  @MinLength(1)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(MIN_WORK_ASSIGNMENT_BUDGET, { message: "Budget must be at least ₹1" })
  budgetAmount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsISO8601()
  @Validate(IsDueDateAtLeastTomorrowConstraint)
  dueDate?: string;
}
