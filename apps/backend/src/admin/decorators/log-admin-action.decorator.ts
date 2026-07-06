import { SetMetadata } from "@nestjs/common";

export const ADMIN_ACTION_KEY = "adminAction";
export const LogAdminAction = (action: string) => SetMetadata(ADMIN_ACTION_KEY, action);
