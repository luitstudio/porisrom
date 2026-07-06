import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    return this.prisma.db.category.findMany({ orderBy: { name: "asc" } });
  }

  listSkills(categoryId?: string) {
    return this.prisma.db.skill.findMany({
      where: categoryId ? { categoryId } : undefined,
      orderBy: { name: "asc" },
    });
  }

  createCategory(name: string, slug: string) {
    return this.prisma.db.category.create({ data: { name, slug } });
  }

  createSkill(name: string, categoryId?: string) {
    return this.prisma.db.skill.create({ data: { name, categoryId } });
  }
}
