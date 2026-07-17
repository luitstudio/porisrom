import { IsIn, IsOptional, IsUrl, MinLength } from "class-validator";

const DELIVERABLE_TYPES = [
  "demo",
  "preview",
  "watermarked_file",
  "drive_link",
  "github_link",
  "file",
] as const;
export type DeliverableTypeInput = (typeof DELIVERABLE_TYPES)[number];

export class CreateDeliverableDto {
  @IsIn(DELIVERABLE_TYPES)
  type!: DeliverableTypeInput;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsOptional()
  @MinLength(1)
  note?: string;
}
