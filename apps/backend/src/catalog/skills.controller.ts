import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CatalogService } from "./catalog.service";
import { CreateSkillDto } from "./dto/create-skill.dto";

@Controller("skills")
export class SkillsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list(@Query("categoryId") categoryId?: string) {
    return this.catalogService.listSkills(categoryId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  create(@Body() dto: CreateSkillDto) {
    return this.catalogService.createSkill(dto.name, dto.categoryId);
  }
}
