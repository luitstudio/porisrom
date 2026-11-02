import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class SafetyReasonDto {
  @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value)
  @IsString() @MinLength(10) @MaxLength(2000)
  reason!: string;
}
export class BlockUserDto {
  @Matches(/^[A-Za-z0-9_-]{1,128}$/)
  blockedUserId!: string;
}
export class ReportUserDto extends SafetyReasonDto {
  @Matches(/^[A-Za-z0-9_-]{1,128}$/)
  targetUserId!: string;
  @IsIn(["harassment", "spam", "fraud", "inappropriate_content", "other"])
  category!: string;
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{1,128}$/)
  conversationId?: string;
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{1,128}$/)
  assignmentId?: string;
}
export class SupportCaseDto extends SafetyReasonDto {
  @IsIn(["account", "technical", "payment", "privacy", "other"])
  category!: string;
}
export class ReviewSafetyCaseDto extends SafetyReasonDto {
  @IsIn(["resolve", "dismiss", "cancel_assignment", "deny_cancellation"])
  decision!: "resolve" | "dismiss" | "cancel_assignment" | "deny_cancellation";
}
export class SafetyCaseQueryDto {
  @IsOptional() @IsIn(["user_report", "cancellation", "support"])
  kind?: "user_report" | "cancellation" | "support";
}
