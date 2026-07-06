import { Module } from "@nestjs/common";

import { CategoriesController } from "./categories.controller";
import { CatalogService } from "./catalog.service";
import { SkillsController } from "./skills.controller";

@Module({
  controllers: [CategoriesController, SkillsController],
  providers: [CatalogService],
})
export class CatalogModule {}
