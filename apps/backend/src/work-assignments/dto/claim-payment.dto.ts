import { MinLength } from "class-validator";

export class ClaimPaymentDto {
  @MinLength(1)
  utr!: string;
}
