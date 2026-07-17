import { Controller, Get, Query } from "@nestjs/common";

import { LeaderboardService } from "./leaderboard.service";

@Controller("leaderboard")
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get("freelancers")
  freelancers(@Query("minRatingCount") minRatingCount?: string) {
    return this.leaderboardService.listFreelancers(
      minRatingCount ? Number(minRatingCount) : undefined,
    );
  }

  @Get("companies")
  companies(@Query("minRatingCount") minRatingCount?: string) {
    return this.leaderboardService.listCompanies(
      minRatingCount ? Number(minRatingCount) : undefined,
    );
  }
}
