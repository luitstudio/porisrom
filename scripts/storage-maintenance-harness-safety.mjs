export function parseStorageMaintenanceHarnessOptions(argv) {
  const options = { preserveResources: false };
  for (const argument of argv) {
    if (argument === "--preserve-resources") options.preserveResources = true;
    else throw Error("Usage: node run-storage-maintenance-postgres-it.mjs [--preserve-resources]");
  }
  return options;
}

export async function finalizeStorageMaintenanceHarness({ preserveResources, postgresId, discoverPostgresId, verifyOwnership, down, removeRoot }) {
  let selectedId = postgresId;
  if (!selectedId) {
    try { selectedId = await discoverPostgresId(); } catch { /* Ownership cannot be established; preserve resources. */ }
  }
  if (preserveResources) return { cleanup: "preserved-by-request", postgresId: selectedId || null };
  if (!selectedId) return { cleanup: "preserved-for-inspection", postgresId: null };
  await verifyOwnership(selectedId);
  await down();
  await removeRoot();
  return { cleanup: "verified-project-volume-removed", postgresId: selectedId };
}
