# Historical archives

The 25 October 2026 folder cleanup retained the following material as compact archives:

- `source-before-cleanup-2026-10-25.zip`: the pre-1.0 source snapshot, unused prototype components/UI library, old styles, and scaffold configuration. The ZIP contains the original `before-1.0`, `components`, `styles`, and `guidelines` folders plus the removed root configuration files.
- `verification-2026-10-24.zip`: earlier JSON test reports, screenshots, exported test fixtures, and installer logs. Paths below `cleanup-evidence/` correspond to the former `.verification/` layout.
- `verification-cleanup-2026-10-25.zip`: installer/native results and a validation summary from checking the reorganized source, including hashes of every preserved release file.

Extract an archive to a separate folder to review or recover its contents. These files are historical references; they do not participate in application builds. The original release folders, ZIPs, companion installers, and their contents remain under `releases/`.

Fresh tests recreate `.verification/`. Build output and native `bin/obj` directories can be removed with `npm run clean`. Verified installer build tools are cached under `.cache/installer-tools/` and can be downloaded again by the companion build script.
