import { IsIn, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

const PORTFOLIO_ITEM_TYPES = ["image", "video", "link", "document"] as const;
export type PortfolioItemTypeInput = (typeof PORTFOLIO_ITEM_TYPES)[number];

export class CreatePortfolioItemDto {
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(PORTFOLIO_ITEM_TYPES)
  type!: PortfolioItemTypeInput;

  @IsUrl({ require_tld: false })
  url!: string;
}
