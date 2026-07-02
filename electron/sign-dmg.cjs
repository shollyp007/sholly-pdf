// afterAllArtifactBuild hook: code-sign + notarize + staple each built .dmg.
//
// electron-builder signs/notarizes the .app (see afterSign -> notarize.cjs) but
// leaves the .dmg wrapper unsigned, so a freshly downloaded disk image reports
// "no usable signature" to Gatekeeper. This hook closes that gap so the .dmg
// itself is signed + notarized + stapled, and then refreshes the .dmg hashes in
// latest-mac.yml (which signing invalidated) so the published update metadata
// stays accurate. macOS auto-update uses the .zip, so this never affects updates.
//
// No-ops cleanly on non-mac and when the APPLE_* signing env vars are absent
// (local unsigned dev builds), exactly like notarize.cjs.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { notarize } = require('@electron/notarize');

function findDeveloperIdIdentity() {
  if (process.env.CSC_NAME) return process.env.CSC_NAME;
  const out = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning']).toString();
  const match = out.match(/"(Developer ID Application: [^"]+)"/);
  if (!match) {
    throw new Error('[sign-dmg] No "Developer ID Application" identity found in keychain.');
  }
  return match[1];
}

function sha512Base64(file) {
  return crypto.createHash('sha512').update(fs.readFileSync(file)).digest('base64');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.default = async function afterAllArtifactBuild(context) {
  if (process.platform !== 'darwin') return;

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  if (!appleId || !appleIdPassword || !teamId) {
    console.log('[sign-dmg] Skipping DMG signing: APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID not set.');
    return;
  }

  const dmgs = (context.artifactPaths || []).filter((p) => p.endsWith('.dmg'));
  if (dmgs.length === 0) return;

  const identity = findDeveloperIdIdentity();
  const ymlPath = path.join(context.outDir, 'latest-mac.yml');
  let yml = fs.existsSync(ymlPath) ? fs.readFileSync(ymlPath, 'utf8') : null;

  for (const dmg of dmgs) {
    const base = path.basename(dmg);
    console.log(`[sign-dmg] Code-signing ${base} with "${identity}"`);
    execFileSync('codesign', ['--force', '--sign', identity, dmg], { stdio: 'inherit' });
    execFileSync('codesign', ['--verify', '--verbose=2', dmg], { stdio: 'inherit' });

    console.log(`[sign-dmg] Notarizing ${base}…`);
    // @electron/notarize staples the ticket automatically on success.
    await notarize({ appBundleId: 'com.sholly.pdf', appPath: dmg, appleId, appleIdPassword, teamId });
    console.log(`[sign-dmg] ${base} signed + notarized + stapled.`);

    // Refresh the now-stale sha512/size for this .dmg in latest-mac.yml.
    // electron-builder writes the url with spaces replaced by '-'.
    if (yml) {
      const urlName = base.replace(/ /g, '-');
      const sha = sha512Base64(dmg);
      const size = fs.statSync(dmg).size;
      const re = new RegExp(`(- url: ${escapeRegExp(urlName)}\\n\\s+sha512: )[^\\n]+(\\n\\s+size: )\\d+`);
      if (re.test(yml)) {
        yml = yml.replace(re, `$1${sha}$2${size}`);
      } else {
        console.log(`[sign-dmg] Warning: no latest-mac.yml entry found for ${urlName}; skipped hash update.`);
      }
    }

    // The .dmg.blockmap describes the pre-signing bytes; drop it so no stale
    // differential map ships (mac updates use the .zip, not the .dmg).
    const blockmap = `${dmg}.blockmap`;
    if (fs.existsSync(blockmap)) fs.rmSync(blockmap);
  }

  if (yml) {
    fs.writeFileSync(ymlPath, yml);
    console.log('[sign-dmg] Updated latest-mac.yml with re-signed .dmg hashes.');
  }
};
