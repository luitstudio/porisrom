import { MinLength } from "class-validator";

export class SendMessageDto {
  @MinLength(1)
  body!: string;
}
