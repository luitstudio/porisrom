import { IsIn, IsOptional, IsString } from "class-validator";

const RESPOND_ACTIONS = ["accept", "reject", "request_modification"] as const;
export type RespondAction = (typeof RESPOND_ACTIONS)[number];

export class RespondWorkAssignmentDto {
  @IsIn(RESPOND_ACTIONS)
  action!: RespondAction;

  @IsOptional()
  @IsString()
  note?: string;
}
