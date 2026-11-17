import { SetMetadata } from "@nestjs/common";

export const STORAGE_MUTATION_KEY = "storage-mutation";
export const StorageMutation = () => SetMetadata(STORAGE_MUTATION_KEY, true);
