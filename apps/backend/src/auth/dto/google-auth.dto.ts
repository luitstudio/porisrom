import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class GoogleAuthDto {
  @IsString()
  @MinLength(1)
  idToken!: string;

  @IsOptional()
  @IsString()
  signupIntent?: string;
}

export class GoogleLinkDto extends GoogleAuthDto {
  @IsString()
  @MinLength(1)
  linkIntentNonce!: string;
}

export class GoogleSignupIntentDto {
  @IsIn(["freelancer", "client"])
  role!: "freelancer" | "client";

  @IsBoolean()
  acceptedTerms!: boolean;
}
