import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { mkdir, realpath, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

type StorageConfig = Record<string, unknown>;
const STORAGE_KEYS = ["NODE_ENV", "KYC_LOCAL_FALLBACK_ENABLED", "PRIVATE_DOCUMENT_UPLOAD_DIR", "KYC_DOCUMENT_UPLOAD_DIR", "PROFILE_PHOTO_UPLOAD_DIR"] as const;
const PRIVATE_PREFIX = "private-local:";
const LEGACY_PREFIX = "local:";

export function storageConfig(config: Pick<ConfigService, "get">): StorageConfig {
  return Object.fromEntries(STORAGE_KEYS.map(key => [key, config.get<string>(key)]));
}

function configured(config: StorageConfig, key: string, fallback: string) {
  const value = config[key];
  return resolve(typeof value === "string" && value.trim() ? value.trim() : fallback);
}

export function publicUploadsRoot(config: StorageConfig = process.env) {
  return configured(config, "PROFILE_PHOTO_UPLOAD_DIR", join(process.cwd(), "uploads"));
}

export function publicAssetRoots(config: StorageConfig) {
  const root = publicUploadsRoot(config);
  return [join(root, "profile-photos"), join(root, "public")];
}

function privateRoot(config: StorageConfig) {
  return configured(config, "PRIVATE_DOCUMENT_UPLOAD_DIR", join(process.cwd(), "private-uploads"));
}

function legacyRoot(config: StorageConfig) {
  return configured(config, "KYC_DOCUMENT_UPLOAD_DIR", publicUploadsRoot(config));
}

export function isInside(root: string, target: string) {
  const path = relative(root, target);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`));
}

function overlaps(a: string, b: string) {
  return isInside(a, b) || isInside(b, a);
}

export function localDocumentFallbackEnabled(config: StorageConfig) {
  if (config.NODE_ENV === "production") return false;
  const flag = config.KYC_LOCAL_FALLBACK_ENABLED;
  return typeof flag === "string" && flag.trim()
    ? ["1", "true", "yes", "on"].includes(flag.trim().toLowerCase())
    : true;
}

function assertRootsSeparated(config: StorageConfig, roots: string[]) {
  for (const publicRoot of roots.slice(0, 2)) {
    for (const documentRoot of roots.slice(2)) {
      if (overlaps(publicRoot, documentRoot)) {
        throw new Error("Private document storage must be separate from all public asset directories");
      }
    }
  }
  const flag = config.KYC_LOCAL_FALLBACK_ENABLED;
  if (config.NODE_ENV === "production" && typeof flag === "string" && /^(1|true|yes|on)$/i.test(flag.trim())) {
    throw new Error("KYC_LOCAL_FALLBACK_ENABLED must be disabled in production");
  }
}

function allRoots(config: StorageConfig) {
  return [...publicAssetRoots(config), privateRoot(config), join(legacyRoot(config), "kyc-documents"), join(legacyRoot(config), "company-documents")];
}

export function validateDocumentStorageConfig(config: StorageConfig) {
  assertRootsSeparated(config, allRoots(config));
  return config;
}

// Resolve existing ancestors too, so a missing child cannot conceal a junction/symlink.
async function physicalPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(await physicalPath(parent), relative(parent, path));
  }
}

export async function validateDocumentStoragePaths(config: StorageConfig) {
  validateDocumentStorageConfig(config);
  assertRootsSeparated(config, await Promise.all(allRoots(config).map(physicalPath)));
}

export function isLocalDocumentId(id: string) {
  return id.startsWith(PRIVATE_PREFIX) || id.startsWith(LEGACY_PREFIX);
}

/** New writes are private; legacy IDs retain protected read/replacement compatibility. */
export class LocalDocumentStorage {
  constructor(private readonly config: StorageConfig, private readonly namespace: "kyc-documents" | "company-documents") {}

  private parse(id: string) {
    const prefix = id.startsWith(PRIVATE_PREFIX) ? PRIVATE_PREFIX : id.startsWith(LEGACY_PREFIX) ? LEGACY_PREFIX : "";
    const key = id.slice(prefix.length);
    const parts = key.split("/");
    if (!prefix || parts.length < 2 || parts[0] !== this.namespace ||
      parts.slice(0, -1).some(part => !/^[a-zA-Z0-9_-]+$/.test(part)) ||
      !/^[a-zA-Z0-9_-]+\.pdf$/.test(parts.at(-1)!)) {
      throw new ServiceUnavailableException("Private document storage could not be resolved");
    }
    return { root: prefix === PRIVATE_PREFIX ? privateRoot(this.config) : legacyRoot(this.config), key };
  }

  private async safePath(id: string) {
    try {
      await validateDocumentStoragePaths(this.config);
      const { root, key } = this.parse(id);
      const namespaceRoot = await physicalPath(join(root, this.namespace));
      const physicalRoot = await physicalPath(root);
      if (!isInside(physicalRoot, namespaceRoot)) throw new Error("Invalid document directory");
      const path = await physicalPath(resolve(root, key));
      if (!isInside(namespaceRoot, path)) throw new Error("Invalid document path");
      return path;
    } catch {
      throw new ServiceUnavailableException("Private document storage could not be resolved");
    }
  }

  async write(key: string, bytes: Buffer) {
    const id = `${PRIVATE_PREFIX}${key}`;
    const path = await this.safePath(id);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    // Recheck after mkdir; never follow an existing document file link on writes.
    const verifiedPath = await this.safePath(id);
    await writeFile(verifiedPath, bytes, { flag: "wx", mode: 0o600 });
    return id;
  }

  async file(id: string) {
    const path = await this.safePath(id);
    const info = await stat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
      throw new ServiceUnavailableException("Private document storage is unavailable");
    });
    if (!info?.isFile()) throw new NotFoundException("Document not found");
    return path;
  }

  async remove(id: string) {
    await unlink(await this.safePath(id));
  }
}
