# Smart Visitor Management System (VMS)

React + TypeScript frontend · Spring Boot 4.1 backend (Java 25) · PostgreSQL database.
All screens read live data from the database. Demo visitors and vehicles are removed by migrations (section 7).
The zip layout is described in ZIP_FORMAT.md.

## 1. Project structure

```
vms-project/
├── README.md                  this procedure document
├── ZIP_FORMAT.md              zip layout, what is excluded, how to replace an old copy
├── CHANGES.md                 what changed in this version
├── docker-compose.yml         database + backend + frontend in containers (optional)
├── start-local.sh / .bat      start the backend locally
├── .env.example               optional overrides for docker-compose
├── database/
│   ├── 01_create_database.sql run once as PostgreSQL superuser (local PostgreSQL only)
│   └── 02_reset_database.sql  drops and recreates the schema (development reset)
├── backend/                   Spring Boot 4.1, Java 25, Gradle, Flyway, Spring Data JPA
│   ├── build.gradle, settings.gradle, gradlew, gradlew.bat, Dockerfile
│   └── src/main/
│       ├── java/com/zyger/vms/
│       │   ├── VmsApplication.java
│       │   ├── config/        AppConfig, AppProperties
│       │   ├── domain/        Visit, VisitorProfile, VehicleEntry, Gate, Department, Photo, VisitStatus
│       │   ├── dto/           request/response records (VisitorRegistrationRequest, VehicleRequest, AlertItem, …)
│       │   ├── repository/    Spring Data repositories
│       │   ├── security/      SecurityConfig (CORS, stateless)
│       │   ├── service/       VisitService, VehicleService, AlertService, CheckpointService,
│       │   │                  ReportService (CSV), DashboardService, PhotoService
│       │   └── web/           REST controllers under /api
│       └── resources/
│           ├── application.yml
│           └── db/migration/  V1__schema.sql … V5__demo_cleanup_load_weight_gate.sql
└── frontend/                  React 18, TypeScript, Vite 8, Tailwind CSS 4, react-router 7
    ├── package.json, vite.config.ts, tsconfig.json, postcss.config.js, tailwind.config.js
    ├── index.html, nginx.conf.template, Dockerfile, .env.example
    ├── public/resource/       logo
    └── src/
        ├── App.tsx, main.tsx
        ├── pages/             Dashboard, VisitorRegistration, VisitorApproval, VehicleEntry,
        │                      QRCheckInOut (check in/out), Reports, Master
        ├── components/        SpeechToText (speech-to-text microphone for the forms), GatePass, QrCode,
        │                      QrScanner, CameraCapture, PhotoThumb, NotificationBell, Layout, Topbar, …
        ├── lib/               api.ts (HTTP client), speech.ts (speech to text and field parsing),
        │                      pdf.ts (PDF writer),
        │                      qr.ts (QR encoder), auth.tsx, useLoad.ts, format.ts, photo.ts
        ├── types/index.ts     shared TypeScript types
        └── index.css, components/*.css
```

## 2. Requirements

| Tool | Version |
|---|---|
| Java (JDK) | 25 |
| PostgreSQL | 16 (or Docker) |
| Node.js | 22 LTS (20.19 or newer also works) |
| Browser for speech to text and QR scanning | Chrome, Edge or Safari, opened on **localhost or HTTPS** |

## 3. Create the database

Option A, local PostgreSQL (run once, as the PostgreSQL superuser):

```
sudo -u postgres psql -f database/01_create_database.sql
```

This creates role `vms` (password `vms123`) and database `vms`. Override the connection with
`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` and `SPRING_DATASOURCE_PASSWORD` if needed.

Option B, Docker: `docker compose up --build` creates the database automatically (section 6).

## 4. Run the backend

```
cd backend
./gradlew bootRun          (Windows: gradlew.bat bootRun)
```

Or from the project root: `./start-local.sh` (Windows: `start-local.bat`).

On start, Flyway applies migrations V1 to V5 automatically. The API runs on **http://localhost:8080**.
Health check: http://localhost:8080/actuator/health

Tests and a production jar:

```
cd backend
./gradlew build            (runs tests and creates build/libs/)
```

## 5. Run the frontend

```
cd frontend
npm install
npm run dev                → open http://localhost:5173
```

Open the app as **localhost** (not a LAN address such as 192.168.x.x). Browsers allow the microphone only on
localhost or HTTPS, so speech to text needs this. Vite forwards `/api` to the backend on port 8080
(`VITE_PROXY_TARGET` changes the target).

Production build:

```
cd frontend
npm run build              (type-checks with tsc, then writes dist/)
npm run preview            (serves dist/ on port 4173, also localhost)
```

Start the backend first, then the frontend.

## 6. Run everything with Docker (optional)

```
cp .env.example .env       (optional; defaults work)
docker compose up --build
```

The web app is on http://localhost:3000 (`WEB_PORT`). The database port is `DB_PORT`.

## 7. Demo data and migrations

| Migration | Effect |
|---|---|
| V1 | Creates the tables. |
| V2 | Seeds reference data (departments, gates 1–3) and sample rows. |
| V3 | Deletes the sample visitors and vehicles that V2 inserted. |
| V4 | Adds photo storage. |
| V5 | Deletes remaining sample visits, sample vehicles and their orphan profiles; adds `vehicle_entries.load_weight_kg` and `visits.gate_id`. |

A new database ends with no visitors or vehicles. Departments and gates remain as reference data and can be
changed under **Master**. Applied migrations must not be edited (Flyway checksums); add a new `V6__…sql` for later changes.

## 8. Using the main features

**Speech to text** (Visitor Registration and Vehicle Entry)

Each form has a **Speech to text** panel at the top. Choose the language (English, Tamil or Hindi), tap **Start speaking**, and
say the field name followed by its value. The words appear in the panel and the form fields fill as you speak. Tap **Stop** when done.

* Visitor example: "name Ravi Kumar, mobile nine eight four five zero one one two two three, purpose meeting, host Karan,
  department IT, gate one".
* Vehicle example: "vehicle number KA 05 MN 4471, driver Suresh, load weight 2500, material steel, gate one".
* Mobile numbers keep the last 10 digits, e-mail ("ravi at nimbus dot co") becomes ravi@nimbus.co, vehicle numbers are shown as
  KA 05 MN 4471, and department and gate are matched against the Master lists.
* The panel shows which fields were filled. Correct any field by typing.
* Speech to text needs Chrome, Edge or Safari on localhost or HTTPS, and an internet connection.

**Other screens**

* **Vehicle Entry.** Enter the load weight in kg (for example 2500). The gate log shows load weight, gate and entry/exit times.
  **Log exit** closes a vehicle.
* **Check In / Out.** Scan the pass QR code with the camera, or type the pass number. Today's history shows check-in and check-out
  times. Visitors or vehicles still inside after 6 hours are flagged, and after 24 hours they are escalated.
* **Dashboard, Today's Visitor Log.** Select a row to see that visitor's full details. **Delete** removes the visit and its photo
  after a confirmation (`DELETE /api/visitors/{code}`).
* **Reports.**
  * Choose a **Period**: Last 1 week (the last 7 days including today), Last 1 month or Last 3 months (both end today),
    or Custom dates (set From and To yourself).
  * **Download PDF** saves the table on screen as an A4 landscape PDF with headers, page numbers and the generation time.
  * **Export Excel (CSV)** saves the same rows as a CSV file.

## 9. Replacing an older copy of this project

See ZIP_FORMAT.md, section "Replacing an older copy". In short: delete the old files it lists, copy the new folder over,
delete `frontend/node_modules` and `backend/build`, then run `npm install` and `./gradlew bootRun` again.

## 10. Verification status

* **Frontend:** a TypeScript check (`tsc --noEmit`, strict, no unused code) passes; run `npm run build` on your machine. Browser tests (Playwright, with speech recognition and the API simulated) check
  the Period dropdown,
  the PDF downloads, and that `/login` opens the dashboard. PDFs were read back with pdftotext, including an 80-row table across three pages.
* **Database:** migrations V1 to V5 were applied to PostgreSQL 16 on a fresh database and on one with demo rows.
* **Backend:** the Java sources were checked for syntax and symbols. A full Gradle build needs Maven Central, which was not
  reachable from the build environment, so run `./gradlew build` on your machine. The backend is unchanged in this version.
* **Not tested:** a real microphone. The field-parsing code was tested on sample sentences in English and Hindi; please try speech
  to text in Chrome on localhost.

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| `tsc` errors about Voice, VoiceFill, VoiceInput, useVoice, voice, dictation, Login, MicIcon or FieldMic | Delete the old files listed in ZIP_FORMAT.md, then `npm install`. |
| Backend cannot connect to PostgreSQL | Check section 3 and the `SPRING_DATASOURCE_*` values. |
| Flyway "checksum mismatch" | An applied migration was edited. Restore it, or reset the dev database with `database/02_reset_database.sql`. |
| Microphone is blocked or does not start | Open the app on http://localhost:5173 (not a LAN address), click the lock icon in the address bar, allow the microphone, and reload. The Speech to text panel shows the reason. |
| Speech to text says "needs Chrome, Edge or Safari" | Use a supported browser. |
| Gate list is empty | Add active gates under Master. Registration and vehicle entry need at least one active gate. |
| Reports are empty | No visitors or vehicles match the period. Choose a wider period. |
