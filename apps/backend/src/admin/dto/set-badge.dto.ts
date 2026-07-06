import { IsBoolean } from "class-validator";

export class SetBadgeDto {
  @IsBoolean()
  isBadgeVerified!: boolean;
}
