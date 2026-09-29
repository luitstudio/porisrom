import { IsIn } from "class-validator";

export class ReviewIdentityDocumentDto {
  @IsIn(["approved", "rejected"])
  status!: "approved" | "rejected";
}
