import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { ConnectionsModule } from "./connections/connections.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { HealthController } from "./health/health.controller";
import { LeaderboardModule } from "./leaderboard/leaderboard.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { SearchModule } from "./search/search.module";
import { WorkAssignmentsModule } from "./work-assignments/work-assignments.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CatalogModule,
    ProfilesModule,
    AdminModule,
    SearchModule,
    ConnectionsModule,
    ConversationsModule,
    WorkAssignmentsModule,
    ReviewsModule,
    LeaderboardModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
