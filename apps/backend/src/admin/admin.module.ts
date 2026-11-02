import { Module } from "@nestjs/common";

import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { PaymentDisputesService } from "./payment-disputes.service";
import { RealtimeModule } from "../realtime/realtime.module";
import { KycModule } from "../kyc/kyc.module";
import { ProfilesModule } from "../profiles/profiles.module";

@Module({
  imports: [RealtimeModule, KycModule, ProfilesModule],
  controllers: [AdminController],
  providers: [AdminService, PaymentDisputesService],
})
export class AdminModule {}
