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
import { RealtimeModule } from "./realtime/realtime.module";
import { SearchModule } from "./search/search.module";
import { WorkAssignmentsModule } from "./work-assignments/work-assignments.module";
import { validateProductionAuthSecrets } from "./auth/production-auth-config";
import { validateDocumentStorageConfig } from "./document-storage";
import { SafetyModule } from "./safety/safety.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: config => validateDocumentStorageConfig(validateProductionAuthSecrets(config)) }),
    PrismaModule,
    AuthModule,
    CatalogModule,
    ProfilesModule,
    AdminModule,
    SearchModule,
    ConnectionsModule,
    ConversationsModule,
    WorkAssignmentsModule,
    SafetyModule,
    ReviewsModule,
    RealtimeModule,
    LeaderboardModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
