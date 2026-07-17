import { IsOptional, IsString } from "class-validator";

export class CancelWorkAssignmentDto {
  @IsOptional()
  @IsString()
  note?: string;
}
