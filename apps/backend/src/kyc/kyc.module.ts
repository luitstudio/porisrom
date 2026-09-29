import { Module } from "@nestjs/common";

import { IdentityDocumentService } from "./identity-document.service";

@Module({
  providers: [IdentityDocumentService],
  exports: [IdentityDocumentService],
})
export class KycModule {}
