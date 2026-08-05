import { IsNotEmpty, IsString } from "class-validator";

export class BroadcastNotificationDto {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;
}
