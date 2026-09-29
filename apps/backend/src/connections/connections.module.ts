import { Module } from "@nestjs/common";

import { ConnectionsController } from "./connections.controller";
import { ConnectionsService } from "./connections.service";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [RealtimeModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
})
export class ConnectionsModule {}
