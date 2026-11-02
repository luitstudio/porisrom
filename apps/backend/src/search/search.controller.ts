import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { SearchCompaniesDto } from "./dto/search-companies.dto";
import { SearchFreelancersDto } from "./dto/search-freelancers.dto";
import { SearchService } from "./search.service";

@Controller("search")
@UseGuards(OptionalJwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get("freelancers")
  searchFreelancers(@Query() query: SearchFreelancersDto, @CurrentUser() user?: CurrentUserPayload) {
    return this.searchService.searchFreelancers(query, user?.userId);
  }

  @Get("companies")
  searchCompanies(@Query() query: SearchCompaniesDto, @CurrentUser() user?: CurrentUserPayload) {
    return this.searchService.searchCompanies(query, user?.userId);
  }
}
