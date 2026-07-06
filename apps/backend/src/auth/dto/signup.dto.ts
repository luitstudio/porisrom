import { IsEmail, IsIn, MinLength } from "class-validator";

export class SignupDto {
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsIn(["freelancer", "client"])
  role!: "freelancer" | "client";
}
