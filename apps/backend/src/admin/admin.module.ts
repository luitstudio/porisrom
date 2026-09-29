import { Module } from "@nestjs/common";

import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { RealtimeModule } from "../realtime/realtime.module";
import { KycModule } from "../kyc/kyc.module";

@Module({
  imports: [RealtimeModule, KycModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
