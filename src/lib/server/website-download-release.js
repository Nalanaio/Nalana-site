// Temporary website-only override. Set to null to restore stable manifest/relay
// routing. Never change stable-latest or updater manifests for this switch.
export const WEBSITE_DOWNLOAD_OVERRIDE = Object.freeze({
  label: 'Nalana Beta (Build 16)',
  mac: 'https://github.com/Nalanaio/nalana-dev-builds/releases/download/beta-latest/nalana-macos-arm64-beta-b16-a68fea16.dmg',
  windows: 'https://github.com/Nalanaio/nalana-dev-builds/releases/download/beta-latest/nalana-windows-x64-beta-b16-a68fea16.exe',
});
