# VMS: changes in this version

## Dashboard: Today's Visitor Log
- **Row details.** Select a row to open the visitor's full details above the log (photo, pass, mobile, email, company, purpose,
  host, department, gate, visit and check-in/out times, status).
- **Delete.** Each row has a Delete button. After a confirmation it removes the visit and its photo; the visitor's saved profile is
  removed as well when that was their only visit. New endpoint: `DELETE /api/visitors/{code}`.

## Speech to text replaces voice entry
- The old voice entry is deleted (guided prompts, per-field microphones, What was heard list and their files).
- Visitor Registration and Vehicle Entry now have one **Speech to text** panel. Choose English, Tamil or Hindi, tap Start speaking
  and say field names with their values; the fields fill as you speak.
- Mobile (last 10 digits), e-mail ("at" and "dot"), vehicle number (KA 05 MN 4471) and load weight are cleaned up automatically;
  department and gate are matched to the Master lists.
- Removed files: Voice*.tsx, FieldMic.tsx, voice.css, lib/voice.ts, lib/useVoice.ts, lib/dictation.ts. New: components/SpeechToText.tsx, lib/speech.ts.

## Reports
- **Visitor details panel removed.** Rows in the visitor log are no longer clickable and no detail panel opens.
- **Download template (Excel) removed** from the vehicle report, together with the template builder.
- Period dropdown (Last 1 week, Last 1 month, Last 3 months, Custom dates), Download PDF and Export Excel (CSV) are unchanged.

## Login
- The /login route was removed. Every page opens directly, and unknown addresses go to the dashboard.

## Earlier changes in this release
- Mock data removed by migration V5. A new database starts with no visitors or vehicles.
- Visitor registration: entry gate required; the gate is saved and printed on the pass.
- Vehicle entry: load weight (kg) saved and shown in the gate log.
- Dashboard: Pending Approval removed; 6-hour and 24-hour alerts for visitors and vehicles.
- Check In / Out: QR camera scanner, today's check-in/out history and alerts panel; header notification bell.
- Printable pass shows a real QR code; only the pass is printed.
