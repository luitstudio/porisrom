import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewsService } from "./reviews.service";

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post("work-assignments/:id/reviews")
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id") id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.userId, id, dto);
  }

  @Get("freelancers/:id/reviews")
  listForFreelancer(@Param("id") id: string) {
    return this.reviewsService.listForFreelancer(id);
  }

  @Get("companies/:id/reviews")
  listForCompany(@Param("id") id: string) {
    return this.reviewsService.listForCompany(id);
  }
}
