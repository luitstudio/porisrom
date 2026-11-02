import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeClusterService } from "./realtime-cluster.service";

@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeGateway, RealtimeClusterService],
  exports: [RealtimeGateway, RealtimeClusterService],
})
export class RealtimeModule {}
