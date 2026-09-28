# Sholly PDF 1.0.9 — branding update

## Deliverables

- Store package: `release/Sholly PDF 1.0.9.appx` (version 1.0.9.0).
- Desktop installer: `release/Sholly PDF Setup 1.0.9.exe`.
- Store listing logo: `store-assets/Sholly-PDF-logo-300x300.png`.
- Larger logos: 512x512 and 1024x1024 in `store-assets`.
- Promotional artwork: `store-assets/Sholly-PDF-branding-1920x1080.png`.
  This is branding artwork, NOT an application screenshot.

The new geometric turquoise/apricot mark replaces the Windows executable,
installer, AppX tiles, favicon, editor header, landing screen and license-screen
branding. Mac/Linux icon source assets were regenerated too; their packages
were not built or tested on this Windows system.

## Verification

- TypeScript and production web build passed.
- Windows AppX and NSIS installer builds passed.
- Six packaged AppX icons match the new source assets byte-for-byte.
- Existing Store identity and publisher were preserved; version is 1.0.9.0.
- Packaged application version and favicon were verified.
- PNG/JPEG export implementation is unchanged from the repository baseline.
- Interactive application and export smoke testing has not been performed.
- No installation, GitHub push, Store upload, or submission was performed.

AppX SHA256:
`2FE04D673E3DF8445E82B66C34DBB05D4BCD2B635A5ED32497925E1FA638EC30`

## Remaining submission work

Upload the new AppX to the existing product submission in Partner Center,
replace the Store listing logo, and replace screenshots showing the old logo
with actual screenshots of the updated app. Review the original certification
report for any other issues before resubmitting.

Suggested certification note:

> Version 1.0.9 replaces the previous branding with a geometric turquoise S
> and apricot accent on a navy background. The package icons and in-app
> branding have been updated consistently to address the reported icon
> similarity concern.

The Store-only AppX is unsigned for submission. The separate desktop installer
is also unsigned; it may be blocked or warned about by Windows. Do not disable
Windows security to run it. Microsoft review and signing are not completed,
and the redesign does not guarantee certification or trademark clearance.

## Rebuilding

Use Node/npm with the checked-in lockfile, then `npm ci`, `npm run build`, and
`npx electron-builder --win appx nsis --x64 --publish never`.
`scripts/build-branding.cjs` regenerates assets using the SVG master and Sharp
(supply a Sharp module path as its argument). The temporary `.tools` folder is
ignored by Git; it contains this machine's npm and packaging-tool cache.
On this machine add `.tools` to the process PATH and set
`ELECTRON_BUILDER_CACHE` to the project's `.tools/cache` for packaging. The
legacy helper bundle there excludes Mac-only symlinks that require Windows
privileges. No system security configuration was changed.

Run `scripts/verify-store-package.ps1` after building to verify package icons
and identity again. Original icon revisions remain in Git history.
