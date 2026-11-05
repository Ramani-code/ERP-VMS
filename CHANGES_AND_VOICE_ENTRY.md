# VMS – error fixes, voice entry and dependencies

This document lists every change made to the project in this package, the voice-entry
method added to the visitor screens, and the dependencies needed to run it.

## 1. What was fixed

### Backend (Spring Boot)

| # | File | Problem | Fix |
|---|------|---------|-----|
| B1 | `security/SecurityConfig.java` | The `/error` page was behind authentication. Any unhandled server error came back as **401/403 with no body**, and the frontend then showed the misleading "Your session has expired". | `/error` is now `permitAll()`, so the real error reaches the client. |
| B2 | `web/GlobalExceptionHandler.java` | Only two exception types were handled. Bad dates or numbers, malformed JSON, duplicate records (database constraint errors) and unexpected bugs all produced unclear responses. | Every error now returns the same JSON shape (`status`, `error`, `message`). Added handlers for: bad parameter values (400), malformed request bodies (400), duplicate or conflicting data (409), and unexpected errors (500 with a safe generic message; the full stack trace goes to the server log only). Framework errors such as an unknown URL keep their own status. |
| B3 | `service/VisitService.java` (`checkIn`) | A pass approved for **any** future date could be checked in today. That is wrong for a gate. | Check-in now requires the pass's visit date to be today; otherwise it returns 409 with the valid date. |
| B4 | `service/ReportService.java` | The export file name used the system clock while the rest of the service used the injected clock, so the two could disagree around midnight. | Uses the injected clock everywhere. |

### Frontend (React + Vite)

| # | File | Problem | Fix |
|---|------|---------|-----|
| F1 | `pages/Reports.tsx` | The vehicle report's loader returned `Promise.resolve([])` in one branch and real data in the other. TypeScript infers a mixed union for that, which can fail `tsc -b` under strict mode. | The empty branch is typed as `VehicleLog[]`. |

### Docker

| # | File | Problem | Fix |
|---|------|---------|-----|
| D1 | `frontend/Dockerfile` | `package-lock.json` was never copied into the image, so every build resolved versions again and could drift from the lockfile. | The lockfile is copied and used by `npm install`. |

### Deliberately not changed

- **Database migrations V1, V2, V3 were not edited.** Flyway stores a checksum of every applied migration. Editing one would make existing databases fail with a checksum mismatch. Any future schema change must go in a new file, `V4__…sql`.
- **Java version.** The project targets Java 25. JDK 21 or older fails with `invalid source release: 25`. Install JDK 25 (or let Gradle provision one).

## 2. Voice entry

### How it works

Voice entry uses the browser's built-in **Web Speech API**. The speech is turned into text in the browser,
and the text is cleaned up for the field it goes into. The backend does not change.

- Each field that supports speech has a **microphone button** beside it. Tap it, speak, and the words appear
  in the field. Tap it again to stop. Typing still works everywhere.
- The live transcript is shown while you speak ("Listening… “ravi mal…”").
- Recognition language is `en-IN` (`VOICE_LANG` in `frontend/src/lib/voice.ts`), which suits Indian names and
  mobile numbers. Change that one constant for another language.

### Where it is used

| Screen | Fields with a microphone | Clean-up applied to the spoken words |
|--------|--------------------------|--------------------------------------|
| Visitor Registration | Visitor name, Mobile number, Email, Company, Purpose of visit, Host name | Names are title-cased. Mobile numbers are spoken as digits and formatted like `98450 11223`. Email: "ravi **dot** m **at** nimbus **dot** co" becomes `ravi.m@nimbus.co`. Free text is appended to what is already typed. |
| QR Check-In / Out (gate) | Pass number | "QR two zero two six zero zero zero one" becomes `QR-2026-0001`. The lookup runs straight after speaking, so the guard never has to touch the screen. |

Spoken words are converted to symbols and digits in `normalizeSpoken()` (`frontend/src/lib/voice.ts`).
`frontend/src/lib/voice.ts` contains the logic, and the normaliser was tested with 16 spoken-input cases
(phone, email, pass number, names, free text); all pass.

### Files added

- `frontend/src/lib/voice.ts`: speech hook (`useVoiceInput`), spoken-text normaliser, browser detection.
- `frontend/src/components/VoiceInput.tsx`: input with a microphone button, live transcript and error message.
- `frontend/src/components/voice.css`: styles (pulsing red button while listening, reduced-motion support).

### Browser and security requirements

- **Chrome, Edge or Safari** (desktop or Android/iOS). **Firefox does not support the Web Speech API.** There the
  microphone button is hidden and the form works as before.
- **Secure context required.** The page must be opened as `https://…` or `http://localhost…`. Opening it by
  LAN IP (for example `http://192.168.1.20:3000`) disables the microphone in browsers. Put the site behind HTTPS
  for that setup.
- The first time, the browser asks for microphone permission. If the user denies it, the field shows a clear
  message, and they can allow it in the browser's site settings.
- Chrome and Edge send the audio to the browser vendor's speech service to recognise it. Do not use voice
  entry for information that must stay on-premises unless that is acceptable. An on-premises option (Vosk or
  Whisper on the backend) would need new server-side dependencies; it is not included here.

## 3. Dependencies

### New packages

**None.** Voice entry uses the browser's built-in API, so `frontend/package.json` and `backend/build.gradle`
have no new entries. That keeps the install small and avoids an extra third-party wrapper.

### Runtime requirements (unchanged)

| Component | Version | Notes |
|-----------|---------|-------|
| JDK | **25** | Set by `sourceCompatibility` in `backend/build.gradle`. |
| Gradle | 9.6.0 | Downloaded automatically by `backend/gradlew`. |
| Spring Boot | 4.1.0 | Managed through the Gradle plugin in `backend/build.gradle`. |
| PostgreSQL | 16 or newer (Docker uses 18) | Schema created by Flyway on first start. |
| Node.js | 20 or newer (Docker uses 22) | For the Vite frontend. |
| Browser (voice only) | Chrome, Edge, Safari | See above. |

## 4. How to run and check

```bash
# Option A – Docker (recommended)
docker compose up --build              # web: http://localhost:3000   API: http://localhost:8080

# Option B – local
sudo -u postgres psql -f database/01_create_database.sql
cd backend && ./gradlew build && cd ..  # compiles, runs tests, builds app.jar
./start-local.sh                        # backend on :8080
cd frontend && npm install && npm run build && npm run dev   # frontend on :5173
```

Quick checks:

1. `curl http://localhost:8080/actuator/health` returns `{"status":"UP"}`.
2. Sign in as `reception@zyger.com` / `Vms@12345`.
3. Visitor Registration → tap the microphone beside **Visitor name** and say a name. Say a mobile number as digits.
4. QR Check-In / Out → say the pass number. It is looked up as soon as it is spoken.
5. Send a bad request, for example `GET /api/reports/vehicles?from=not-a-date` as admin. It should return a clear
   400 JSON message, not a 401/403 or a blank page.

## 5. Limits of this package

- The project could not be fully compiled inside the environment used to prepare it: the Maven and Gradle
  repositories and the npm registry were unreachable from it. The Java changes were checked for syntax, and
  the frontend voice code was type-checked for its own logic and tested against the spoken-input cases. Run
  `./gradlew build` and `npm run build` once on your machine to confirm.
- If a start-up error still occurs, send the first 40 lines of the backend log. They identify the cause far
  faster than guessing from the code.
