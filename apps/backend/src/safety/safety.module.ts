import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { AdminSafetyController, SafetyController } from "./safety.controller";
import { SafetyService } from "./safety.service";
@Module({ imports: [RealtimeModule], controllers: [SafetyController, AdminSafetyController], providers: [SafetyService], exports: [SafetyService] })
export class SafetyModule {}
