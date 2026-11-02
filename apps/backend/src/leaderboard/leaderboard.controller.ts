import { Controller, Get, Query } from "@nestjs/common";

import { LeaderboardService } from "./leaderboard.service";
import { LeaderboardQueryDto } from "./dto/leaderboard-query.dto";

@Controller("leaderboard")
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get("freelancers")
  freelancers(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.listFreelancers(query.minRatingCount);
  }

  @Get("companies")
  companies(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.listCompanies(query.minRatingCount);
  }
}
