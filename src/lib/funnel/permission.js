let session = null;
export function setActiveFunnel(value) { session = value; }
export function recordDownloadClick() { return session?.click() ?? null; }
