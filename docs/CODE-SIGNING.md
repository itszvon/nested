# Code signing and the SmartScreen warning

## What the warning actually is

Windows Defender SmartScreen refuses to run an `.exe` it has never seen from a
publisher it cannot verify. For this build, both are true:

```
Status      = NotSigned
Signer      =
Company     =            (empty)
Product     = Nested
Description = Nested for Windows
Version     = 0.1.2
```

`Get-AuthenticodeSignature` returns `NotSigned`, so there is no publisher at
all, and the file hash has no download history, so there is no reputation to
fall back on. SmartScreen is behaving as designed; the app is not being flagged
as malicious, it is being treated as unknown.

**This cannot be fixed in code.** Reputation is attached to a signing identity,
not to a repository. Every route below works by giving Windows an identity it
can check.

## Routes, with real costs

| Route | Cost | Time to no warning | Effort |
|---|---|---|---|
| Azure Trusted Signing | ~$10/month | Usually same day (Microsoft-issued identity) | 30 min setup + CI |
| OV certificate (DigiCert, Sectigo, SSL.com) | ~$250-400/year | Weeks to months: reputation accrues per identity | 1-2 weeks for identity verification |
| EV certificate | ~$400-600/year + hardware token / cloud HSM | Immediate on first release | 1-2 weeks verification, plus token logistics |
| Microsoft Store (MSIX) | $19 one-time Partner Center | Never shows SmartScreen: the Store signs it | Packaging change + review |

If the goal is "the next person who downloads it does not see a scary dialog",
the two realistic answers are **Azure Trusted Signing** (cheapest, fastest) or
the **Store** (free of the dialog entirely, but a different distribution model).

## Azure Trusted Signing (recommended)

1. Azure portal → create a **Trusted Signing Account** in a supported region.
2. Complete **identity validation** for the publisher (individual or
   organisation). This is the step that takes days, not minutes.
3. Create a **Certificate Profile** of type `PublicTrust`.
4. Create a service principal with the `Trusted Signing Certificate Profile
   Signer` role on the account.
5. Provide three values to CI:

   ```
   AZURE_TENANT_ID
   AZURE_CLIENT_ID
   AZURE_CLIENT_SECRET
   ```

6. `electron-builder.yml` gains:

   ```yaml
   win:
     azureSignOptions:
       publisherName: Nested
       endpoint: https://<region>.codesigning.azure.net
       codeSigningAccountName: <account>
       certificateProfileName: <profile>
   ```

   `electron-builder` signs `Nested.exe`, the uninstaller and the installer.

7. Verify on the built artifact:

   ```powershell
   Get-AuthenticodeSignature .\Nested-Setup-0.1.2.exe | Format-List Status, SignerCertificate
   signtool verify /pa /v .\Nested-Setup-0.1.2.exe
   ```

   `Status` must read `Valid`, and the signer subject must match what the
   certificate profile says.

## Traditional certificate (OV or EV)

1. Buy from a CA that issues code-signing certificates for individuals or
   companies. EV ships on a hardware token or cloud HSM; that is the cost of
   instant reputation.
2. Import the certificate, then either:
   - export a `.pfx` and set `CSC_LINK` (base64 or path) plus `CSC_KEY_PASSWORD`
     in the release environment, or
   - keep it in the CA's cloud HSM and use their signing tool.
3. `electron-builder` picks `CSC_LINK` up automatically. The workflow already
   passes both variables.
4. EV: reputation is immediate. OV: SmartScreen keeps warning until enough
   installs accumulate against that identity; there is no way to shortcut it.

## What not to do

- **Self-signed certificate.** Windows shows "Unknown publisher" and the user
  must install your root certificate first. Strictly worse than unsigned.
- **Telling people to disable SmartScreen.** It trains users to ignore the one
  control that matters.
- **Renaming or re-uploading the file to dodge the hash.** Reputation follows
  the identity; a new hash just restarts at zero.

## Until a certificate exists

1. Publish the SHA-256 next to the download, so a user can verify what they got:

   ```powershell
   Get-FileHash .\Nested-Setup-0.1.2.exe -Algorithm SHA256
   ```

2. Say plainly on the download page that the build is unsigned, what
   SmartScreen will say, and the two clicks that get past it. It already does.
3. Optionally submit the file to Microsoft for review:
   https://www.microsoft.com/en-us/wdsi/filesubmission
   This can clear a specific false positive. It does not grant publisher
   identity and does not prevent the warning on the next build.

## Guard for the future

`npm run verify:signature` checks the built installer and fails when it is not
signed, so an unsigned artifact cannot be published by accident once signing is
configured. Run it in the release job after `dist`.
