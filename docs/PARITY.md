# Web to desktop parity

Conversion track: every web capability is kept, adapted, or explicitly dropped.

| Capability | Disposition | Notes |
|---|---|---|
| Sign in with Google | Adapted | System browser + loopback callback; the app never hosts a login form |
| Files, folders, tree | Kept | Same server, same RLS |
| Editor (plain text / code) | Kept + extended | Markdown toolbar added in the shell and the web build |
| Versions, snapshots, trash | Kept | Unchanged |
| Runner (JS/TS/Python/SQL, HTML/CSS preview) | Kept | Worker + sandboxed iframe |
| Remote runner (Java/C++/Go/Rust/Bash) | Kept | Still requires network |
| Export zip / account data | Kept | Native save dialog added |
| Admin panel | Kept | Same account flag |
| Suggestions | Kept | Unchanged |
| Legal pages, security.txt, sitemap | Kept | Opened in the system browser from Help |
| Cookie banner | Dropped | No tracking cookies on either platform |
| Address bar, reload chrome, marketing nav | Dropped | Native window and menu instead |
| Browser download prompts | Replaced | Native save dialog |
| Deep links | Added | `nested://file/<uuid>` |
| Auto-update | Added | electron-updater, gated on unsaved work |
| Offline reading/writing | Not provided | Same as the web app; the app is a shell over the account |
| Service worker / PWA install | Dropped | Superseded by the installer |
