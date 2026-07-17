import { IsOptional, IsString } from "class-validator";

export class RequestRevisionDto {
  @IsOptional()
  @IsString()
  note?: string;
}
