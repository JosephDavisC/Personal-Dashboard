// Module-level sync version for cross-device real-time updates.
// Single Node.js process in Docker standalone mode, so module state is shared.
// Resets on restart — clients see a new version and refetch, which is correct.

let version = Date.now();

export function getSyncVersion(): number {
  return version;
}

export function bumpSync(): void {
  version = Date.now();
}
