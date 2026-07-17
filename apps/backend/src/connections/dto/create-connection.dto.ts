import { MinLength } from "class-validator";

export class CreateConnectionDto {
  @MinLength(1)
  receiverId!: string;
}
