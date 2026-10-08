export const OFFLINE_RESOURCE_SCHEMA = 1;

export function validateOfflineManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== OFFLINE_RESOURCE_SCHEMA || !Array.isArray(manifest.resources)) {
    throw new TypeError("invalid offline resource manifest");
  }
  for (const resource of manifest.resources) {
    if (!resource.path || !resource.sha256 || !Number.isInteger(resource.bytes)) {
      throw new TypeError("offline resource entries require path, sha256 and bytes");
    }
  }
  return manifest;
}
