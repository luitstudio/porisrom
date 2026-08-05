import { IsNotEmpty, IsString } from "class-validator";

export class SendDirectMessageDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}
