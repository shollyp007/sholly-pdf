# Signing & Notarizing the Mac build

This produces a Mac app that opens with no Gatekeeper warning. It requires an
**active** Apple Developer membership ($99/yr). Until then, build unsigned with
`CSC_IDENTITY_AUTO_DISCOVERY=false npm run electron:build:mac` (runs on your own
Mac, not distributable).

## One-time setup

1. **Confirm the membership is active** at https://developer.apple.com/account
   (not "Enrollment Pending").

2. **Create a Developer ID Application certificate** and install it in your login
   keychain. Easiest path: Xcode → Settings → Accounts → (your Apple ID) →
   Manage Certificates → **+** → **Developer ID Application**. Or generate a CSR
   in Keychain Access and create the cert at developer.apple.com → Certificates.
   Verify it landed:

   ```sh
   security find-identity -v -p codesigning
   # should list: "Developer ID Application: <Your Name> (<TEAMID>)"
   ```

3. **Create an app-specific password** at https://appleid.apple.com →
   Sign-In and Security → App-Specific Passwords. (This is NOT your normal Apple
   ID password.)

4. **Find your Team ID** at https://developer.apple.com/account → Membership
   Details (10 characters).

5. **Fill in `.env.signing`** (already created, gitignored — never commit it):

   ```sh
   export APPLE_ID=olusolaadeaga@gmail.com
   export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
   export APPLE_TEAM_ID=XXXXXXXXXX
   ```

## Build a signed + notarized release

```sh
source .env.signing && npm run electron:build:mac
```

What happens automatically:
- electron-builder signs the app with the Developer ID cert it finds in your
  keychain (hardened runtime + `build/entitlements.mac.plist` are already
  configured).
- The `afterSign` hook (`electron/notarize.cjs`) uploads to Apple, waits for
  notarization, and staples the ticket. It prints `Notarization complete.`
  (Notarization can take a few minutes.)

> Do **not** set `CSC_IDENTITY_AUTO_DISCOVERY=false` for a release build — that
> flag is only for unsigned local builds and will skip signing.

## Verify the result

```sh
# from the built app in release/mac-arm64 (and release/mac for x64)
codesign --verify --deep --strict --verbose=2 "release/mac-arm64/Sholly PDF.app"
spctl -a -vvv -t install "release/mac-arm64/Sholly PDF.app"   # expect: accepted, source=Notarized Developer ID
xcrun stapler validate "release/mac-arm64/Sholly PDF.app"      # expect: The validate action worked!
```

Ship the `.dmg` files from `release/`. A correctly notarized DMG opens on any
Mac with a normal double-click — no right-click-Open, no `xattr` needed.

## Troubleshooting
- **"No identity found" / unsigned output** — the Developer ID cert isn't in the
  keychain, or `CSC_IDENTITY_AUTO_DISCOVERY=false` is set. Re-check step 2.
- **Notarization skipped** — one of the three env vars is empty; `source
  .env.signing` again in the same shell you build from.
- **Notarization rejected** — run `xcrun notarytool log <submission-id>
  --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password
  "$APPLE_APP_SPECIFIC_PASSWORD"` to see why (usually a missing entitlement or
  unsigned nested binary).
