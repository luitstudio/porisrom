import { Module } from "@nestjs/common";

import { WorkAssignmentsController } from "./work-assignments.controller";
import { WorkAssignmentsService } from "./work-assignments.service";

@Module({
  controllers: [WorkAssignmentsController],
  providers: [WorkAssignmentsService],
})
export class WorkAssignmentsModule {}
