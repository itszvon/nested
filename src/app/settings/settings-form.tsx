"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FONT_SIZES, type EditorSettings } from "@/lib/settings";
import {
  changeEmail,
  confirmEmailChange,
  confirmUsernameChange,
  deleteAccount,
  exportAccountData,
  requestUsernameChange,
  updateEditorSettings,
  updateProfile,
} from "../app/actions";

const QUOTA = 25 * 1024 * 1024;

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-rule py-8 first:pt-0">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{title}</h2>
      {hint ? <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">{hint}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

const field =
  "h-9 w-full border border-rule bg-ground px-3 text-[13px] text-ink outline-none focus:border-accent";
const label = "block font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint mb-1.5";
const secondary =
  "h-8 border border-rule px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:border-rule-strong hover:text-ink disabled:opacity-40";
const primary =
  "h-8 border border-accent bg-accent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white disabled:opacity-40";

export function SettingsForm({
  profile,
  settings,
  usage,
}: {
  profile: { username: string; email: string; displayName: string; avatar: string | null };
  settings: EditorSettings;
  usage: { storageBytes: number; files: number; folders: number };
}) {
  const router = useRouter();

  const [avatar, setAvatar] = useState<string | null>(profile.avatar);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [profileState, setProfileState] = useState<"idle" | "saving" | "saved">("idle");
  const [profileError, setProfileError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Username changes are confirmed by an emailed link. Display name and
  // picture are not.
  const [username, setUsername] = useState(profile.username);
  const [usernamePanel, setUsernamePanel] = useState(false);
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameNotice, setUsernameNotice] = useState<string | null>(null);
  const [usernameStage, setUsernameStage] = useState<"edit" | "code">("edit");
  const [usernameCode, setUsernameCode] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);

  // An email change is confirmed by the link Supabase sends to the new address.
  const [emailPanel, setEmailPanel] = useState(false);
  const [emailNext, setEmailNext] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [emailStage, setEmailStage] = useState<"edit" | "code">("edit");
  const [emailCode, setEmailCode] = useState("");
  const [emailConfirmBusy, setEmailConfirmBusy] = useState(false);

  const [prefs, setPrefs] = useState<EditorSettings>(settings);
  const [prefsState, setPrefsState] = useState<"idle" | "saving" | "saved">("idle");

  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

  const usedMb = usage.storageBytes / (1024 * 1024);
  const percent = Math.min(100, (usage.storageBytes / QUOTA) * 100);

  async function pickAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("That file is not an image.");
      return;
    }

    try {
      // Downscale before storing: a 128px square keeps the row small enough for
      // the profile table and avoids putting full camera photos in Postgres.
      const bitmap = await createImageBitmap(file);
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("no canvas");

      const scale = Math.max(size / bitmap.width, size / bitmap.height);
      const width = bitmap.width * scale;
      const height = bitmap.height * scale;
      context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);

      setAvatar(canvas.toDataURL("image/jpeg", 0.85));
      setProfileError(null);
    } catch {
      setProfileError("That image could not be read.");
    } finally {
      event.target.value = "";
    }
  }

  async function saveProfile() {
    setProfileState("saving");
    setProfileError(null);
    const result = await updateProfile({ displayName, avatar });
    if (!result.ok) {
      setProfileState("idle");
      setProfileError(result.error);
      return;
    }
    setProfileState("saved");
    router.refresh();
    window.setTimeout(() => setProfileState("idle"), 1500);
  }

  async function sendUsernameConfirmation() {
    setUsernameBusy(true);
    setUsernameError(null);
    setUsernameNotice(null);
    const result = await requestUsernameChange(username);
    setUsernameBusy(false);

    if (!result.ok) {
      setUsernameError(result.error);
      return;
    }

    setUsernameStage("code");
    setUsernameCode("");
    setUsernameNotice(`Code sent to ${profile.email}. Enter it below to finish.`);
  }

  async function confirmPendingUsername() {
    setConfirmBusy(true);
    setUsernameError(null);
    const result = await confirmUsernameChange(usernameCode);
    setConfirmBusy(false);

    if (!result.ok) {
      setUsernameError(result.error);
      return;
    }

    setUsernamePanel(false);
    setUsernameStage("edit");
    setUsernameCode("");
    setUsernameNotice("Username updated.");
    router.refresh();
  }

  async function startEmailChange() {
    setEmailBusy(true);
    setEmailError(null);
    setEmailNotice(null);
    const result = await changeEmail(emailNext);
    setEmailBusy(false);

    if (!result.ok) {
      setEmailError(result.error);
      return;
    }

    setEmailStage("code");
    setEmailCode("");
    setEmailNotice(`Code sent to ${emailNext.trim()}. Enter it below to finish.`);
  }

  async function confirmEmail() {
    setEmailConfirmBusy(true);
    setEmailError(null);
    const result = await confirmEmailChange(emailCode);
    setEmailConfirmBusy(false);

    if (!result.ok) {
      setEmailError(result.error);
      return;
    }

    setEmailPanel(false);
    setEmailStage("edit");
    setEmailCode("");
    setEmailNext("");
    setEmailNotice("Email updated.");
    router.refresh();
  }

  async function savePrefs(next: EditorSettings) {
    setPrefs(next);
    setPrefsState("saving");
    const result = await updateEditorSettings(next);
    setPrefsState(result.ok ? "saved" : "idle");
    if (result.ok) {
      router.refresh();
      window.setTimeout(() => setPrefsState("idle"), 1500);
    }
  }

  async function download() {
    setExporting(true);
    const result = await exportAccountData();
    setExporting(false);
    if (!result.ok) return;

    const blob = new Blob([result.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nested-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function removeAccount() {
    if (confirmName.trim() !== profile.username) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteAccount();
    if (!result.ok) {
      setDeleting(false);
      setDeleteError(result.error);
      return;
    }
    window.location.href = "/home";
  }

  return (
    <div>
      <Section title="Profile" hint="Shown in the app header. Only you can see it.">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center border border-rule-strong bg-panel">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-16 w-16 object-cover" />
            ) : (
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                none
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondary} onClick={() => fileInput.current?.click()}>
              Choose image
            </button>
            {avatar ? (
              <button type="button" className={secondary} onClick={() => setAvatar(null)}>
                Remove
              </button>
            ) : null}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              onChange={pickAvatar}
              className="hidden"
            />
          </div>
        </div>

        <div>
          <label className={label} htmlFor="display-name">
            Display name
          </label>
          <input
            id="display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={profile.username}
            className={field}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="username">
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setUsernameError(null);
                setUsernameNotice(null);
              }}
              autoComplete="off"
              spellCheck={false}
              disabled={usernamePanel && usernameStage === "code"}
              className={`${field} font-mono disabled:opacity-60`}
            />

            {usernamePanel ? (
              <div className="mt-2 border border-rule p-3">
                {usernameStage === "edit" ? (
                  <>
                    <p className="text-[11px] leading-relaxed text-ink-faint">
                      A six-digit code goes to {profile.email}. The username changes only after
                      you enter that code here.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void sendUsernameConfirmation()}
                        disabled={usernameBusy || username.trim() === profile.username}
                        className={primary}
                      >
                        {usernameBusy ? "Sending" : "Send code"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUsernamePanel(false);
                          setUsernameStage("edit");
                          setUsernameCode("");
                          setUsernameError(null);
                        }}
                        className={secondary}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] leading-relaxed text-ink-faint">
                      Enter the code sent to {profile.email}.
                    </p>
                    <input
                      value={usernameCode}
                      onChange={(event) => {
                        setUsernameCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 8));
                        setUsernameError(null);
                      }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      className={`${field} mt-2 font-mono tracking-[0.3em]`}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void confirmPendingUsername()}
                        disabled={confirmBusy || usernameCode.length < 6}
                        className={primary}
                      >
                        {confirmBusy ? "Checking" : "Confirm change"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendUsernameConfirmation()}
                        disabled={usernameBusy}
                        className={secondary}
                      >
                        {usernameBusy ? "Sending" : "Send again"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUsernamePanel(false);
                          setUsernameStage("edit");
                          setUsernameCode("");
                          setUsernameError(null);
                        }}
                        className={secondary}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setUsernamePanel(true);
                  setUsernameStage("edit");
                  setUsernameCode("");
                  setUsernameError(null);
                  setUsernameNotice(null);
                }}
                disabled={username.trim().toLowerCase() === profile.username}
                className={`${secondary} mt-2`}
              >
                Change username
              </button>
            )}

            {usernameError ? <p className="mt-2 text-[11px] text-red-300">{usernameError}</p> : null}
            {usernameNotice ? (
              <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">{usernameNotice}</p>
            ) : null}
          </div>

          <div>
            <label className={label}>Email</label>
            <p className="h-9 truncate border border-rule bg-panel/50 px-3 py-2 font-mono text-[12px] text-ink-dim">
              {profile.email}
            </p>

            {emailPanel ? (
              <div className="mt-2 border border-rule p-3">
                {emailStage === "edit" ? (
                  <>
                    <p className="text-[11px] leading-relaxed text-ink-faint">
                      The new address gets a six-digit code. The change finishes only after you
                      enter that code here.
                    </p>
                    <input
                      type="email"
                      value={emailNext}
                      onChange={(event) => setEmailNext(event.target.value)}
                      placeholder="New email"
                      autoComplete="off"
                      className={`${field} mt-2`}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void startEmailChange()}
                        disabled={emailBusy || emailNext.trim() === ""}
                        className={primary}
                      >
                        {emailBusy ? "Sending" : "Send code"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmailPanel(false);
                          setEmailNext("");
                          setEmailError(null);
                        }}
                        className={secondary}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] leading-relaxed text-ink-faint">
                      Enter the code sent to {emailNext.trim() || "the new address"}.
                    </p>
                    <input
                      value={emailCode}
                      onChange={(event) => {
                        setEmailCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 8));
                        setEmailError(null);
                      }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      className={`${field} mt-2 font-mono tracking-[0.3em]`}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void confirmEmail()}
                        disabled={emailConfirmBusy || emailCode.length < 6}
                        className={primary}
                      >
                        {emailConfirmBusy ? "Checking" : "Confirm change"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void startEmailChange()}
                        disabled={emailBusy}
                        className={secondary}
                      >
                        {emailBusy ? "Sending" : "Send again"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmailPanel(false);
                          setEmailStage("edit");
                          setEmailCode("");
                          setEmailError(null);
                        }}
                        className={secondary}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEmailPanel(true);
                  setEmailStage("edit");
                  setEmailCode("");
                  setEmailError(null);
                  setEmailNotice(null);
                }}
                className={`${secondary} mt-2`}
              >
                Change email
              </button>
            )}

            {emailError ? <p className="mt-2 text-[11px] text-red-300">{emailError}</p> : null}
            {emailNotice ? (
              <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">{emailNotice}</p>
            ) : null}
          </div>
        </div>

        {profileError ? <p className="text-[11px] text-red-300">{profileError}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={profileState === "saving"}
            className={primary}
          >
            {profileState === "saving" ? "Saving" : "Save profile"}
          </button>
          {profileState === "saved" ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
              saved
            </span>
          ) : null}
        </div>
      </Section>

      <Section title="Editor" hint="Applies to every file, on every device.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="tab-size">
              Tab size
            </label>
            <select
              id="tab-size"
              value={prefs.tabSize}
              onChange={(event) => void savePrefs({ ...prefs, tabSize: Number(event.target.value) === 4 ? 4 : 2 })}
              className={field}
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
            </select>
          </div>

          <div>
            <label className={label} htmlFor="font-size">
              Font size
            </label>
            <select
              id="font-size"
              value={prefs.fontSize}
              onChange={(event) => void savePrefs({ ...prefs, fontSize: Number(event.target.value) })}
              className={field}
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { key: "lineNumbers" as const, text: "Line numbers in code files" },
            { key: "wordWrap" as const, text: "Wrap long lines" },
          ].map((option) => (
            <label key={option.key} className="flex items-center gap-3 text-[13px] text-ink-dim">
              <input
                type="checkbox"
                checked={prefs[option.key]}
                onChange={(event) => void savePrefs({ ...prefs, [option.key]: event.target.checked })}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              {option.text}
            </label>
          ))}
        </div>

        {prefsState === "saved" ? (
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">saved</p>
        ) : null}
      </Section>

      <Section title="Storage" hint="Files, versions and trash share one quota.">
        <div>
          <div className="flex items-baseline justify-between font-mono text-[10px] text-ink-faint">
            <span>
              {usedMb < 0.1 ? "<0.1" : usedMb.toFixed(1)} MB of 25 MB
            </span>
            <span>{percent.toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-1 w-full bg-rule">
            <div className="h-1 bg-accent" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
          <div className="border border-rule px-3 py-2">
            <dt>files</dt>
            <dd className="mt-1 text-[15px] tracking-normal text-ink">{usage.files}</dd>
          </div>
          <div className="border border-rule px-3 py-2">
            <dt>folders</dt>
            <dd className="mt-1 text-[15px] tracking-normal text-ink">{usage.folders}</dd>
          </div>
        </dl>
      </Section>

      <Section title="Your data" hint="Every folder, file and saved version, as JSON.">
        <button type="button" onClick={() => void download()} disabled={exporting} className={secondary}>
          {exporting ? "Preparing" : "Export everything"}
        </button>
      </Section>

      <Section
        title="Delete account"
        hint="Removes the account, every folder, every file, and every saved version. This cannot be undone and the trash does not apply."
      >
        <label className={label} htmlFor="confirm-delete">
          Type {profile.username} to confirm
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="confirm-delete"
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            className={`${field} sm:max-w-xs`}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => void removeAccount()}
            disabled={confirmName.trim() !== profile.username || deleting}
            className="h-9 border border-accent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-accent disabled:opacity-40"
          >
            {deleting ? "Deleting" : "Delete account"}
          </button>
        </div>
        {deleteError ? <p className="text-[11px] text-red-300">{deleteError}</p> : null}
      </Section>
    </div>
  );
}
