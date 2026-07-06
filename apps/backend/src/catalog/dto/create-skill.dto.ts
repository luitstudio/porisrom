import { IsOptional, MinLength } from "class-validator";

export class CreateSkillDto {
  @MinLength(1)
  name!: string;

  @IsOptional()
  categoryId?: string;
}
