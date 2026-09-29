import { Module } from "@nestjs/common";

import { WorkAssignmentsController } from "./work-assignments.controller";
import { WorkAssignmentsService } from "./work-assignments.service";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [RealtimeModule],
  controllers: [WorkAssignmentsController],
  providers: [WorkAssignmentsService],
})
export class WorkAssignmentsModule {}
