import { describe, expect, it, vi } from "vitest";

import { CompanyProfileService } from "../src/profiles/company-profile.service";
import { FreelancerProfileService } from "../src/profiles/freelancer-profile.service";

const file = { size: 4, buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]), mimetype: "image/jpeg" } as Express.Multer.File;
const lease = { operationId: "photo-operation", assertNotFenced: async () => undefined };

function trackingMaintenance() {
  const events: string[] = [];
  return {
    events,
    run: vi.fn(async (_kind: string, mutation: (activeLease: typeof lease) => Promise<unknown>) => {
      events.push("admitted");
      try {
        const result = await mutation(lease);
        events.push("completed");
        return result;
      } catch (error) {
        events.push("failed");
        throw error;
      }
    }),
  };
}

describe("profile photo/logo coordinated mutation boundary", () => {
  it("keeps freelancer upload and database reference update in one operation", async () => {
    const maintenance = trackingMaintenance();
    const update = vi.fn().mockResolvedValue({ id: "profile-1", profilePhotoUrl: "https://cdn/new" });
    const storage = { storePublicPhoto: vi.fn().mockResolvedValue({ url: "https://cdn/new", storageId: "cloudinary:new" }), removeStoredPublicPhoto: vi.fn() };
    const service = new FreelancerProfileService({ db: { freelancerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "profile-1", profilePhotoUrl: null, profilePhotoStorageId: null }), update } } } as never, storage as never, maintenance as never);

    await expect(service.uploadProfilePhoto("user-1", file)).resolves.toEqual({ id: "profile-1", profilePhotoUrl: "https://cdn/new" });
    expect(maintenance.run).toHaveBeenCalledWith("profile_photo", expect.any(Function));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { profilePhotoUrl: "https://cdn/new", profilePhotoStorageId: "cloudinary:new" } }));
    expect(maintenance.events).toEqual(["admitted", "completed"]);
  });

  it("keeps company logo upload and database reference update in one operation", async () => {
    const maintenance = trackingMaintenance();
    const update = vi.fn().mockResolvedValue({ id: "company-1", logoUrl: "https://cdn/new-logo" });
    const storage = { storePublicPhoto: vi.fn().mockResolvedValue({ url: "https://cdn/new-logo", storageId: "cloudinary:new-logo" }), removeStoredPublicPhoto: vi.fn() };
    const service = new CompanyProfileService({ db: { companyProfile: { findUnique: vi.fn().mockResolvedValue({ id: "company-1", logoUrl: null, logoStorageId: null }), update } } } as never, storage as never, maintenance as never);

    await expect(service.uploadLogo("company-user", file)).resolves.toEqual({ id: "company-1", logoUrl: "https://cdn/new-logo" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { logoUrl: "https://cdn/new-logo", logoStorageId: "cloudinary:new-logo" } }));
    expect(maintenance.events).toEqual(["admitted", "completed"]);
  });

  it("rolls back a newly uploaded asset and fails the operation when the profile update fails", async () => {
    const maintenance = trackingMaintenance();
    const storage = { storePublicPhoto: vi.fn().mockResolvedValue({ url: "https://cdn/new", storageId: "cloudinary:new" }), removeStoredPublicPhoto: vi.fn().mockResolvedValue(undefined) };
    const service = new FreelancerProfileService({ db: { freelancerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "profile-1", profilePhotoUrl: null, profilePhotoStorageId: null }), update: vi.fn().mockRejectedValue(new Error("database unavailable")) } } } as never, storage as never, maintenance as never);

    await expect(service.uploadProfilePhoto("user-1", file)).rejects.toThrow("database unavailable");
    expect(storage.removeStoredPublicPhoto).toHaveBeenCalledWith(lease, "cloudinary:new");
    expect(maintenance.events).toEqual(["admitted", "failed"]);
  });

  it("fails before any database reference update when local fallback storage fails", async () => {
    const maintenance = trackingMaintenance();
    const update = vi.fn();
    const storage = { storePublicPhoto: vi.fn().mockRejectedValue(new Error("local write failed")), removeStoredPublicPhoto: vi.fn() };
    const service = new CompanyProfileService({ db: { companyProfile: { findUnique: vi.fn().mockResolvedValue({ id: "company-1", logoUrl: null, logoStorageId: null }), update } } } as never, storage as never, maintenance as never);

    await expect(service.uploadLogo("company-user", file)).rejects.toThrow("local write failed");
    expect(update).not.toHaveBeenCalled();
    expect(maintenance.events).toEqual(["admitted", "failed"]);
  });

  it("rolls the database reference back and flags failure when previous-asset cleanup fails", async () => {
    const maintenance = trackingMaintenance();
    const update = vi.fn().mockResolvedValueOnce({ id: "profile-1", profilePhotoUrl: "https://cdn/new" }).mockResolvedValueOnce({ id: "profile-1", profilePhotoUrl: "https://cdn/old" });
    const storage = {
      storePublicPhoto: vi.fn().mockResolvedValue({ url: "https://cdn/new", storageId: "cloudinary:new" }),
      removeStoredPublicPhoto: vi.fn().mockRejectedValueOnce(new Error("old cleanup failed")).mockResolvedValue(undefined),
    };
    const service = new FreelancerProfileService({ db: { freelancerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "profile-1", profilePhotoUrl: "https://cdn/old", profilePhotoStorageId: "cloudinary:old" }), update } } } as never, storage as never, maintenance as never);

    await expect(service.uploadProfilePhoto("user-1", file)).rejects.toThrow("old cleanup failed");
    expect(update).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { profilePhotoUrl: "https://cdn/old", profilePhotoStorageId: "cloudinary:old" } }));
    expect(storage.removeStoredPublicPhoto).toHaveBeenNthCalledWith(2, lease, "cloudinary:new");
    expect(maintenance.events).toEqual(["admitted", "failed"]);
  });

  it("does not complete the operation while a provider upload is still in progress", async () => {
    const maintenance = trackingMaintenance();
    let finishUpload!: () => void;
    const uploadPending = new Promise<void>(resolve => { finishUpload = resolve; });
    const storage = { storePublicPhoto: vi.fn(async () => { await uploadPending; return { url: "https://cdn/new", storageId: "cloudinary:new" }; }), removeStoredPublicPhoto: vi.fn() };
    const update = vi.fn().mockResolvedValue({ id: "company-1", logoUrl: "https://cdn/new" });
    const service = new CompanyProfileService({ db: { companyProfile: { findUnique: vi.fn().mockResolvedValue({ id: "company-1", logoUrl: null, logoStorageId: null }), update } } } as never, storage as never, maintenance as never);

    const upload = service.uploadLogo("company-user", file);
    await vi.waitFor(() => expect(maintenance.events).toEqual(["admitted"]));
    expect(update).not.toHaveBeenCalled();
    finishUpload();
    await upload;
    expect(maintenance.events).toEqual(["admitted", "completed"]);
  });
});
