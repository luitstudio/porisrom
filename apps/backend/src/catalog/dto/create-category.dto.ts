import { MinLength } from "class-validator";

export class CreateCategoryDto {
  @MinLength(1)
  name!: string;

  @MinLength(1)
  slug!: string;
}
