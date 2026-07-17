import { Controller, Get, Query } from "@nestjs/common";

import { SearchCompaniesDto } from "./dto/search-companies.dto";
import { SearchFreelancersDto } from "./dto/search-freelancers.dto";
import { SearchService } from "./search.service";

@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get("freelancers")
  searchFreelancers(@Query() query: SearchFreelancersDto) {
    return this.searchService.searchFreelancers(query);
  }

  @Get("companies")
  searchCompanies(@Query() query: SearchCompaniesDto) {
    return this.searchService.searchCompanies(query);
  }
}
