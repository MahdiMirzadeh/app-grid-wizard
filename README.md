# App Grid Wizard - GNOME Extension

A GNOME Shell extension that auto-organizes your app grid into sensible folders and keeps it tidy over time — while preserving a safe, one-click restore to your original layout.

![App Grid Wizard in Action](screenshot.png)

---

## Features

- One-click organize: creates 13 curated folders (Accessories, Games, Graphics, Internet, …)
- Non-destructive by design: snapshot of your current folders and app layout on first enable
- Manual Restore: restores both folders and app layout to the pre-extension state
- Quick Settings integration: toggle + menu with Restore and Settings
- Auto-compaction: resets `app-picker-layout` so GNOME auto-paginates compactly
- Watches app changes: re-applies folder config when apps are installed/removed (debounced)
- GNOME 45–49

---

## Installation

### From extensions.gnome.org
1. Visit the [App Grid Wizard page on extensions.gnome.org](https://extensions.gnome.org/extension/7867/app-grid-wizard/).
2. Click the toggle to install.
3. Log out and back in.

### Manual installation
```bash
# 1) Get the code
git clone https://github.com/MahdiMirzadeh/app-grid-wizard.git
cd app-grid-wizard

# 2) Package and install (with translations)
# Package with translations from po/ using GNOME's recommended tool
# Run from the extension root directory

gnome-extensions pack --podir=po
# This produces: app-grid-wizard@mirzadeh.pro.shell-extension.zip

gnome-extensions install app-grid-wizard@mirzadeh.pro.shell-extension.zip --force

# 3) Enable
gnome-extensions enable app-grid-wizard@mirzadeh.pro
# Then log out and back in
```

---

## Usage

- Toggle ON in Quick Settings → folders are created and layout is compacted.
- Toggle OFF → extension stops monitoring (folders remain).
- Quick Settings ▸ Restore Original Layout → restores snapshot (folders + layout) and turns the extension OFF.
- Preferences ▸ per-folder toggles + Restore button (also turns the extension OFF).

Note: After Restore, log out/in to ensure the app grid fully reflects changes.

---

## Technical details

This extension changes only GSettings — no private Shell APIs.

### Data model (GSettings)
- App folders: `org.gnome.desktop.app-folders`
  - Key: `folder-children` (as)
  - Per-folder schema: `org.gnome.desktop.app-folders.folder` at path `/org/gnome/desktop/app-folders/folders/<id>/`
    - Keys used: `name` (s), `categories` (as)
  - Managed IDs: `agw-*` only (e.g. `agw-internet`)
- App grid layout: `org.gnome.shell`
  - Key: `app-picker-layout` (aa{sv}) — snapshot/restore; empty `[]` lets GNOME auto-pack
- Extension state: `org.gnome.shell.extensions.app-grid-wizard`
  - `enabled` (b)
  - `snapshot-taken` (b)
  - `original-folder-children` (as)
  - `original-app-layout` (aa{sv})
  - Per-folder booleans: `folder-accessories`, `folder-games`, …

### Behavior spec (contract)
- On first enable when `snapshot-taken=false`:
  1. Snapshot `folder-children` → `original-folder-children`
  2. Snapshot `app-picker-layout` → `original-app-layout`
- Apply (enable or folder pref change):
  1. Compute enabled `agw-*` IDs
  2. Set `folder-children = <enabled agw IDs>` (replaces non-AGW for compactness)
  3. Write each folder’s `name`/`categories`
  4. Set `app-picker-layout = []` (deferred 300ms) to force compact pages
- Restore (Quick Menu or Prefs):
  1. Write `folder-children = original-folder-children`
  2. After 200ms, set `app-picker-layout = original-app-layout` if non-empty, else `[]`
  3. Set `enabled=false`, `snapshot-taken=false`
- Toggle OFF: stop monitoring; do not remove folders (non-destructive)

### Events / timers
- Listen: `Shell.AppSystem::installed-changed`
- Debounce: 2000ms before re-apply
- Layout writes: 200–300ms after folder changes to avoid grid races

### Logging (grep with journalctl)
- Tag prefix: `App-Grid-Wizard:`
- Examples: `Folders applied`, `Snapshot saved`, `Layout set to [] for auto-pagination`

### Invariants
- Only `agw-*` folder IDs are created/managed by the extension
- Restore never writes non-snapshotted data
- No private GNOME Shell APIs are called

### File layout
- `extension.js` – runtime logic, Quick Settings toggle and menu
- `prefs.js` – Adw preferences window
- `schemas/org.gnome.shell.extensions.app-grid-wizard.gschema.xml` – extension keys
- `metadata.json` – UUID `app-grid-wizard@mirzadeh.pro`

### Debugging quick reference
```bash
# Read current folders
gsettings get org.gnome.desktop.app-folders folder-children

# Read layout (non-empty means manual layout exists)
gsettings get org.gnome.shell app-picker-layout

# Force compact layout
gsettings set org.gnome.shell app-picker-layout '[]'

# Watch logs
journalctl /usr/bin/gnome-shell -f | grep "App-Grid-Wizard"
```

### Limitations
- GNOME always lists folders before apps; interleaving is not supported
- No explicit uninstall hook — use Restore, then disable/uninstall

---

## Supported folders

| Folder Name         | Categories Included                          |
|---------------------|-----------------------------------------------|
| Accessories         | Utility                                       |
| Chrome Apps         | chrome-apps                                   |
| Games               | Game                                          |
| Graphics            | Graphics                                      |
| Internet            | Network, WebBrowser, Email                    |
| Office              | Office                                        |
| Programming         | Development                                   |
| Science             | Science                                       |
| Sound & Video       | AudioVideo, Audio, Video                      |
| System Tools        | System, Settings                               |
| Universal Access    | Accessibility                                 |
| Wine                | Wine, X-Wine, Wine-Programs-Accessories       |
| Waydroid            | Waydroid, X-WayDroid-App                      |

---

## Troubleshooting

- First page shows a single stray app? The extension now sets `app-picker-layout` to `[]` after changes; log out/in once if it persists.
- Want your original layout back? Use Restore (Quick Settings or Preferences), then log out/in.

---

## Contributing

PRs and issues welcome:
- Repo: https://github.com/MahdiMirzadeh/app-grid-wizard
- Open issues: https://github.com/MahdiMirzadeh/app-grid-wizard/issues

---

## Donate

If this project helps you, please consider supporting it:

[![Donate](https://img.shields.io/badge/Donate-%E2%9D%A4-red)](https://mirzadeh.pro/donate)

---

## License

MIT — see [LICENSE](LICENSE).
