# בדיקות — שידוכים

## 1. סוגי הבדיקות

| שכבה | פקודה | מה נבדק |
| --- | --- | --- |
| טיפוסים + lint | `npx tsc -b` · `npm run lint` | TypeScript strict, ‏ESLint |
| יחידה + אינטגרציה (Vitest, ‏jsdom) | `npm test` | sanitizer, קבצים (zip/docx/xlsx/csv), מיפוי ייבוא, לוגיקה עסקית, רישום שגיאות, שכבת הנתונים מול backend ההדגמה (יומן, סל מחזור, עריכה מקבילה, מחיקה) |
| בידוד במסד | `npm run verify:rls` | 48 בדיקות: שני חשבונות, כל הטבלאות, View, ‏RPC, ‏Storage, יומן, email_log, עריכה מקבילה, מחיקת חשבון |
| שוויון סינון שרת/לקוח | `npm run verify:filters` | סינון עדה בצד השרת מחזיר בדיוק את מה שמחזיר `edaOf` |
| Edge Function | `npm run verify:email` | ‏16 בדיקות מול ספק מדומה מקומי: הגבלת קצב, idempotency, timeout, ניסיון חוזר, שגיאות |
| E2E ‏(Playwright + axe-core) | `npm run test:e2e` | ‏11 סוויטות, כולל נגישות WCAG 2.1 AA |

סוויטות E2E (`tests/e2e`): ‏`core`, ‏`documents`, ‏`import`, ‏`history`, ‏`concurrency`, ‏`support`, ‏`ideas-resume`, ‏`age`, ‏`move`, ‏`profile`, ‏`account` (האחרונה מוחקת נתונים, ולכן רצה אחרונה).
להרצת סוויטה אחת: `node tests/e2e/run.cjs account`.

## 2. הרצה מקומית

דרישות: Chromium של Playwright, ו-Python 3 עם `python-docx` ו-`openpyxl`. סוויטת `documents` משתמשת בהם כבודק בלתי תלוי לקובצי Word ו-Excel שהמערכת יוצרת:

```bash
pip install python-docx==1.2.0 openpyxl==3.1.5
```

הדגמה (ללא Supabase):

```bash
VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite --host 127.0.0.1 --port 5175 --strictPort
```

```bash
E2E_BASE_URL=http://127.0.0.1:5175 npm run test:e2e
```

Supabase מקומי:

```bash
npx supabase start && npx supabase db reset
```

```bash
npx vite --host 127.0.0.1 --port 5173 --strictPort
```

```bash
E2E_BASE_URL=http://127.0.0.1:5173 E2E_BACKEND=supabase npm run test:e2e
```

`verify:rls` ו-`verify:filters` דורשים `.env.local` ונתוני seed. אחרי הרצת E2E (שמוחקת נתונים) יש להריץ `db reset` לפניהם.

## 3. CI

`.github/workflows/ci.yml` מריץ שלוש משימות בכל push ו-PR:

1. `check`: טיפוסים, lint, ‏Vitest, ‏build.
2. `e2e-demo`: ‏E2E מול backend ההדגמה.
3. `supabase`: ‏Supabase מקומי, מיגרציות ו-seed, ‏RLS, שוויון סינון, ו-E2E מול Supabase.

## 4. מה לא נבדק אוטומטית

- שליחה אמיתית דרך Resend (נבדקה מול ספק מדומה בלבד; דורש מפתח ודומיין).
- שליחה דרך Gmail ב-claude.ai (תלויה בחיבור של המשתמש).
- מסד claude.ai (‏Artifact) נבדק ידנית בפרסום, ולא ב-CI.
- דפדפנים מלבד Chromium.
