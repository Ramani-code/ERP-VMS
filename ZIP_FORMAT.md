# Zip format for this package

## What the zip contains

The zip has one top-level folder, `vms-project/`. Keep that name when you unzip.

```
vms-project/
├── README.md, ZIP_FORMAT.md, CHANGES.md, docker-compose.yml, start-local.sh, start-local.bat, .env.example
├── database/                   01_create_database.sql, 02_reset_database.sql
├── backend/                    build.gradle, settings.gradle, gradlew, gradlew.bat, Dockerfile, .gitignore,
│   │                           .dockerignore, gradle/wrapper/, src/main/java/…, src/main/resources/…
└── frontend/                   package.json, package-lock.json, vite.config.ts, tsconfig.json, index.html,
                                postcss.config.js, tailwind.config.js, Dockerfile, nginx.conf.template,
                                .env.example, .gitignore, .dockerignore, public/, src/
```

The full tree is in README.md, section 1.

## What is left out

These are generated on your computer and are not in the zip. Create them again with the commands in README.md.

| Left out | Created by |
|---|---|
| `frontend/node_modules/` | `npm install` |
| `frontend/dist/` | `npm run build` |
| `frontend/tsconfig.tsbuildinfo` | `npm run build` (TypeScript build cache) |
| `backend/build/`, `backend/.gradle/` | `./gradlew build` or `./gradlew bootRun` |

## Files that must not be in your project

The new package does not contain these. Delete them from an older copy, or the TypeScript build fails:

* `frontend/src/components/Voice.tsx`
* `frontend/src/components/VoiceAssist.tsx`
* `frontend/src/components/VoiceButton.tsx`
* `frontend/src/components/VoiceField.tsx`
* `frontend/src/components/VoiceInput.tsx`
* `frontend/src/components/voice.css`
* `frontend/src/components/FieldMic.tsx`
* `frontend/src/components/VoiceFill.tsx`
* `frontend/src/lib/useVoice.ts`
* `frontend/src/lib/voice.ts`
* `frontend/src/lib/dictation.ts`
* `frontend/src/lib/excel.ts`
* `frontend/src/pages/Login.tsx`
* `frontend/tsconfig.tsbuildinfo`
* `backend/src/main/java/com/zyger/vms/dto/OverstayAlert.java`
* `CHANGES_AND_VOICE_ENTRY.md`

## Replacing an older copy

1. Back up your old folder.
2. Delete the files listed above from it.
3. Replace the `frontend/src` and `backend/src` folders with the ones in the zip. Copy the other files over as well.
4. Delete `frontend/node_modules` and `backend/build` if they exist.
5. Run `npm install` in `frontend`, then `./gradlew bootRun` in `backend`.

## Checking the zip

After unzipping, these must exist and these must not:

* Must exist: `vms-project/README.md`, `vms-project/backend/build.gradle`, `vms-project/frontend/package.json`,
  `vms-project/frontend/src/App.tsx`, `vms-project/frontend/src/components/SpeechToText.tsx`,
  `vms-project/frontend/src/lib/speech.ts`, `vms-project/frontend/src/lib/pdf.ts`,
  `vms-project/backend/src/main/resources/db/migration/V5__demo_cleanup_load_weight_gate.sql`.
* Must not exist: any path listed in "What is left out" or "Files that must not be in your project".
