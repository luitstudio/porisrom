import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { STORAGE_MUTATION_KEY } from "./storage-mutation.decorator";
import { StorageMutationCoordinator } from "./storage-mutation-coordinator.service";

/** Request-level early rejection. The coordinator remains the authoritative,
 * row-locked admission point immediately before provider/local storage I/O. */
@Injectable()
export class StorageMaintenanceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly maintenance: StorageMutationCoordinator,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isStorageMutation = this.reflector.getAllAndOverride<boolean>(STORAGE_MUTATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isStorageMutation) return true;
    await this.maintenance.assertNewMutationsAllowed();
    return true;
  }
}
