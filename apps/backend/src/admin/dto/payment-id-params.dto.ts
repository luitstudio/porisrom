import { Matches } from "class-validator";

export class PaymentIdParamsDto {
  @Matches(/^[A-Za-z0-9_-]{1,128}$/)
  id!: string;
}
