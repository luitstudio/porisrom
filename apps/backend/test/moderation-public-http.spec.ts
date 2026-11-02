import "reflect-metadata";
import { type INestApplication, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FreelancerProfileController } from "../src/profiles/freelancer-profile.controller";
import { FreelancerProfileService } from "../src/profiles/freelancer-profile.service";
import { CompanyProfileController } from "../src/profiles/company-profile.controller";
import { CompanyProfileService } from "../src/profiles/company-profile.service";
import { IdentityDocumentService } from "../src/kyc/identity-document.service";
import { CompanyDocumentService } from "../src/profiles/company-document.service";
import { ReviewsController } from "../src/reviews/reviews.controller";
import { ReviewsService } from "../src/reviews/reviews.service";
import { LeaderboardController } from "../src/leaderboard/leaderboard.controller";
import { LeaderboardService } from "../src/leaderboard/leaderboard.service";
import { SearchController } from "../src/search/search.controller";
import { SearchService } from "../src/search/search.service";

type Where = { id?: string; verificationStatus?: string; user?: { role?: string; status?: string }; ratingCount?: { gte: number } };
// Real routes and services; synthetic ORM evaluates the actual submitted predicates.
function profiles(role: string) {
  const rows = ["active", "blocked", "deleted", "pending", "rejected", "wrong-role"].map((kind) => ({
    id: `${role}-${kind}`, userId: `${role}-${kind}-user`, ratingCount: 5,
    verificationStatus: kind === "pending" || kind === "rejected" ? kind : "approved",
    user: { role: kind === "wrong-role" ? "admin" : role, status: kind === "blocked" || kind === "deleted" ? kind : "active" },
  }));
  const matches = (where: Where = {}) => rows.filter((row) =>
    (!where.id || row.id === where.id) && (!where.verificationStatus || row.verificationStatus === where.verificationStatus) &&
    (!where.user?.role || row.user.role === where.user.role) && (!where.user?.status || row.user.status === where.user.status) &&
    (!where.ratingCount || row.ratingCount >= where.ratingCount.gte));
  return {
    findFirst: async ({ where }: { where: Where }) => matches(where)[0] ?? null,
    findMany: async ({ where }: { where: Where }) => matches(where),
    count: async ({ where }: { where: Where }) => matches(where).length,
  };
}

describe("public moderation eligibility over HTTP", () => {
  let app: INestApplication;
  let base: string;
  beforeAll(async () => {
    const prisma = { db: { freelancerProfile: profiles("freelancer"), companyProfile: profiles("client"),
      review: { findMany: async () => [{ id: "historical-review", rating: 5, author: { id: "moderated-historical-author", name: "Historical author" } }] } } } as never;
    const controllers = [FreelancerProfileController, CompanyProfileController, ReviewsController, LeaderboardController, SearchController];
    for (const [controller, deps] of [
      [FreelancerProfileController, [FreelancerProfileService, IdentityDocumentService]],
      [CompanyProfileController, [CompanyProfileService, CompanyDocumentService]],
      [ReviewsController, [ReviewsService]], [LeaderboardController, [LeaderboardService]], [SearchController, [SearchService]],
    ] as const) Reflect.defineMetadata("design:paramtypes", deps, controller);
    @Module({ controllers, providers: [
      { provide: FreelancerProfileService, useValue: new FreelancerProfileService(prisma, {} as never) },
      { provide: CompanyProfileService, useValue: new CompanyProfileService(prisma, {} as never) },
      { provide: ReviewsService, useValue: new ReviewsService(prisma) },
      { provide: LeaderboardService, useValue: new LeaderboardService(prisma) },
      { provide: SearchService, useValue: new SearchService(prisma) },
      { provide: IdentityDocumentService, useValue: {} }, { provide: CompanyDocumentService, useValue: {} },
    ] }) class PublicModule {}
    app = await NestFactory.create(PublicModule, { logger: false });
    await app.listen(0, "127.0.0.1"); base = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });

  describe.each([["freelancers", "freelancer"], ["companies", "client"]])("%s", (route, role) => {
    it.each(["blocked", "deleted", "pending", "rejected", "wrong-role"])("hides %s profiles and their public reviews", async (kind) => {
      for (const suffix of ["", "/reviews"]) expect((await fetch(`${base}/${route}/${role}-${kind}${suffix}`)).status).toBe(404);
    });
    it("preserves active approved profiles and public reviews", async () => {
      expect((await fetch(`${base}/${route}/${role}-active`)).status).toBe(200);
      const response = await fetch(`${base}/${route}/${role}-active/reviews`);
      expect(response.status).toBe(200); expect(await response.json()).toEqual([expect.objectContaining({ id: "historical-review", author: { id: "moderated-historical-author", name: "Historical author" } })]);
    });
    it("returns consistent discovery items and counts and eligible leaderboards", async () => {
      const discovery = await (await fetch(`${base}/search/${route}`)).json();
      expect(discovery.items.map((row: { id: string }) => row.id)).toEqual([`${role}-active`]);
      expect(discovery.total).toBe(discovery.items.length);
      const leaderboard = await (await fetch(`${base}/leaderboard/${route}`)).json();
      expect(leaderboard.map((row: { id: string }) => row.id)).toEqual([`${role}-active`]);
    });
  });
});
