import { Type } from "class-transformer";
import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength, Validate } from "class-validator";

import { IsDueDateAtLeastTomorrowConstraint, MIN_WORK_ASSIGNMENT_BUDGET } from "./work-assignment-terms";

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
  @Min(MIN_WORK_ASSIGNMENT_BUDGET, { message: "Budget must be at least ₹1" })
  budgetAmount?: number;

  @IsOptional()
  @IsISO8601()
  @Validate(IsDueDateAtLeastTomorrowConstraint)
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
