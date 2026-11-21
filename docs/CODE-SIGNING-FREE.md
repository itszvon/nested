# Signing for free: the two real routes

Everything here was checked against vendor and Microsoft documentation in
November 2026. The paid options are in [CODE-SIGNING.md](CODE-SIGNING.md); this
page is only about getting a **signed, warning-free** Windows install without
spending money.

## What SmartScreen actually checks

Two independent signals:

1. **Identity** - is the file Authenticode-signed by a certificate chaining to
   the Microsoft Trusted Root Program?
2. **Reputation** - has Microsoft seen this publisher identity, or this exact
   file hash, before?

An unsigned file has neither, so it is "unrecognized". SmartScreen does not
report malware; it reports that it cannot attribute the file to anyone. That is
why no amount of code, metadata, or upload trickery changes the dialog: the
only inputs it reads are the signature and the reputation attached to it.

Corollary that matters for planning: **reputation is per certificate**, not per
app. Two routes below hand you a certificate you do not own, which is why they
are free.

## Route A - Microsoft Store (MSIX): free, and no warning at all

| | |
|---|---|
| Cost | **$0**. Registration fees for both individual and company developer accounts were removed; onboarding is at https://storedeveloper.microsoft.com |
| What you get | The Store re-signs your MSIX after certification. Installs from the Store never show SmartScreen |
| Publisher shown | Your name (individual account) |
| Time | Account + identity verification (minutes to a day), packaging, then certification review (typically 1-3 business days) |
| Catch | It is a different distribution model: Store listing, review, Store updates, Store policies |

This is the only route that produces a **guaranteed** warning-free install for a
brand-new app, because the trust comes from Microsoft's own signature rather
than from reputation you have to earn.

Steps:

1. Create the account at https://storedeveloper.microsoft.com (personal
   Microsoft account, ID verification).
2. Reserve the app name in Partner Center.
3. Package as MSIX. For this app the practical path is `electron-builder`'s
   `appx` target (see the snippet at the end; the `identityName`, `publisher`
   and `publisherDisplayName` values only exist after step 2).
4. Submit, provide test sign-in instructions for the reviewer, wait for
   certification.

### Two engineering consequences

- **Turn off self-updates for the Store build.** The Store updates packages; a
  second updater fighting it is how apps end up half-updated. Gate
  `initUpdater` on an env flag (`NESTED_STORE_BUILD=1`) rather than `isPackaged`.
- **The app must work without the loopback port being free.** Store users may
  run other software; the current build already refuses to start when port
  43110 is taken. Acceptable, but it is a new failure mode to document.

## Route B - SignPath Foundation: free, publisher is the foundation

| | |
|---|---|
| Cost | **$0** for qualifying open-source projects (https://signpath.org) |
| What you get | OV-level Authenticode signing through their hosted pipeline; key lives on their HSM |
| Publisher shown | **SignPath Foundation**, not you |
| Time | Application review, then a workflow integration |
| Catch | Strict eligibility, and no guarantee of acceptance |

Their published conditions (https://signpath.org/terms):

- OSI-approved licence, **no commercial dual-licensing** for any component
- no proprietary code in the project
- actively maintained and already released in the form to be signed
- documented publicly (a download page or store entry describing what it does)
- all team members on MFA
- a **published code-signing policy** on the project home page
- SignPath becomes the publisher and can revoke retroactively for rule breaches

Realistic expectation: the foundation favours projects with visible community
signals - stars, forks, outside contributors, articles, sustained activity. A
brand-new single-author project is commonly declined on the first application.
Reapplying later, once the project has a public footprint, is normal.

This repo has **no LICENSE file**, which disqualifies it today. Adding an
OSI-approved licence (MIT or Apache-2.0 for the code; the app's data stays
yours) is a prerequisite and a decision only the owner can make.

If accepted, integration is a GitHub Action that calls their signing step; the
workflow must be gated on their secrets and on a manual approval per release.
A disabled skeleton is at `.github/workflows/signpath.yml.disabled`.

## Route C - the ones that look free and are not

| Option | Why it fails |
|---|---|
| Self-signed certificate | Windows shows "Unknown publisher" and the user must install your root first. Worse than unsigned |
| Sigstore / cosign | Real supply-chain integrity, but Windows does not consult it for SmartScreen |
| Removing Mark-of-the-Web | A per-user workaround; the next download has it again |
| Microsoft file submission | Can clear a specific false positive. It does not grant identity, and it does not carry to the next build |
| Re-uploading with a new hash | Reputation starts at zero again |
| Telling users to disable SmartScreen | Trains users to ignore the control that protects them from actual malware |

Near-free, for completeness: **Certum Open Source** certificate, from €49/year
(cloud), publisher shows "Open Source Developer <your name>", non-commercial
OSI projects only. **Azure Artifact Signing** is $9.99/month and, as an
individual, only available in the US or Canada.

## Recommendation

1. **Start Route A now.** It is free, it is the only guaranteed-clean install,
   and the work is packaging plus a review.
2. **In parallel, add a LICENSE and apply to SignPath** if you want direct
   downloads to be signed too. Even if declined today, the application is free
   and the prerequisites improve the project.
3. Keep the current unsigned NSIS + portable builds for people who will click
   through the warning; they remain the fastest way to try the app.

## Packaging snippet (Store route)

Not active in `electron-builder.yml` because the values come from Partner
Center. Once registered, add:

```yaml
appx:
  applicationId: Nested
  identityName: <PartnerCenter identity name>
  publisher: CN=<PartnerCenter publisher string>
  publisherDisplayName: <your display name>
  displayName: Nested
  languages: [en-US]
  showNameOnTiles: true
```

and build with:

```bash
npx electron-builder --win appx
```

Verify the result before submitting:

```powershell
Get-AppxPackageManifest .\Nested.appx | Select-Object -ExpandProperty Package
```

## Verifying whatever you end up shipping

```powershell
Get-AuthenticodeSignature .\Nested-Setup-0.1.2.exe | Format-List Status, SignerCertificate
```

`Status -eq 'Valid'` and a signer subject you recognise are the only evidence
that matters. `npm run verify:signature -- --strict` enforces it in CI.
