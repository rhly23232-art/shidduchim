# ארכיטקטורה — שידוכים

המסמך מתאר את המערכת כפי שהיא ממומשת בפועל (ענף `main`).

## 1. תמונה כללית

```
דפדפן (React SPA, ‏build סטטי)
 ├─ pages/ + features/*          מסכים ותכונות
 ├─ TanStack Query               מטמון נתוני שרת
 ├─ lib/api/index.ts             בחירת backend בעלייה  ──┐
 │    journaled(dataApi)         היסטוריה + סל מחזור     │
 ├─ lib/files/*                  zip/docx/xlsx/csv        │
 └─ lib/log.ts                   רישום שגיאות + דוח תמיכה │
                                                          ▼
      ┌───────────── Supabase (ייצור) ─────────────┐   מסד claude.ai (Artifact)   הדגמה (IndexedDB)
      │ Postgres + RLS · RPC save_candidate        │
      │ Storage: resumes, journal                  │
      │ Edge Function send-resume-email ──► Resend │
      └────────────────────────────────────────────┘
```

אין שרת אפליקציה. כל הלוגיקה העסקית רצה בדפדפן. אכיפת ההרשאות נעשית במסד (RLS), ולא בקוד הלקוח.

## 2. שכבת הנתונים

ממשק אחד, `DataApi` / `AuthApi` (`src/lib/api/types.ts`), עם שלושה מימושים:

| מימוש | קובץ | מתי |
| --- | --- | --- |
| Supabase | `supabaseApi.ts` | כשמוגדרים `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY` |
| מסד claude.ai | `hostDbApi.ts` | כשהדף רץ כ-Artifact ואין Supabase |
| הדגמה | `demoApi.ts` | בכל מצב אחר (IndexedDB, עם גיבוי בזיכרון) |

- **`journaled()`** עוטף את המימוש הנבחר. כל שמירה נרשמת ליומן (שדה, לפני ← אחרי). כל מחיקה נרשמת כ-"מחיקה" עם עותק מלא: הכרטיס, הקישורים מהרעיונות וקובץ הרזומה. אם שמירת עותק הרזומה נכשלת, המחיקה מבוטלת (`JournalError`).
- **עריכה מקבילה:** כל שמירה שולחת `expected_updated_at`. אם הכרטיס השתנה בינתיים, השמירה נדחית (`ConflictError`; ב-Supabase שגיאה P0409 מה-RPC), והטופס מציע "חזרה לטופס" או "שמירה בכל זאת".
- **קריאה בנפח:** `listCandidates` קורא עמודים של 1,000 במקביל. `listCandidatesFull` קורא מועמדים, משפחה ומחותנים בשלוש בקשות (לגיבוי ולייצוא). מעל 5,000 מועמדים הסינון עובר לשרת (`edaServerFilter` שומר על אותה לוגיקה כמו `edaOf` בלקוח).

## 3. מסד הנתונים (Supabase)

מיגרציות ב-`supabase/migrations`, לפי סדר:

| מיגרציה | תוכן |
| --- | --- |
| `20261109000000_init` | candidates, family, in_laws, ‏`candidates_view` (security_invoker), ‏RPC `save_candidate`, ‏bucket `resumes`, ‏RLS |
| `20261110000000_ideas` | רעיונות |
| `20261111000000_eda` | עמודת עדה |
| `20261112000000_journal` | יומן (append-only) + bucket `journal` |
| `20261113000000_email_log` | רישום שליחות מייל (הגבלת קצב ו-idempotency), ‏revoke מפורש והרשאות לפי עמודה |
| `20261114000000_concurrency` | `save_candidate` עם בדיקת `expected_updated_at` |
| `20261115000000_account_deletion` | `delete_my_account()` ‏(SECURITY DEFINER, ‏authenticated בלבד) |
| `20261116000000_manual_age` | גיל ללא תאריך לידה: `age_years` + `age_recorded_on`. הגיל ב-View מחושב מתאריך הלידה, ואם אין, מהגיל שהוזן ועוד השנים שעברו מאז |

עקרונות:

- כל טבלה ו-bucket מוגנים ב-RLS לפי `owner_id = auth.uid()`.
- Supabase מעניק כברירת מחדל ALL על טבלאות חדשות, ולכן טבלאות רגישות מתחילות ב-`revoke all` ואחריו הרשאות מפורשות.
- היומן נכתב מהלקוח, ולא בטריגר. שינוי שנעשה ישירות במסד לא יירשם (החלטה מתועדת).

## 4. אינטגרציות

| אינטגרציה | מסלול | הגנות |
| --- | --- | --- |
| Resend (מייל + קובץ מצורף) | Edge Function ‏`send-resume-email` | JWT, הגבלת קצב לכל משתמש (30 לשעה, 200 ליום), מפתח idempotency, timeout של 20 שניות, ניסיון חוזר אחד ב-429/5xx/שגיאת רשת עם Idempotency-Key של Resend, ‏ALLOWED_ORIGINS, לוגים כ-JSON |
| Gmail | דרך חיבור ה-MCP של המשתמש ב-claude.ai | timeout של 120 שניות, ללא ניסיון חוזר אוטומטי. במקרה של timeout מוצגת הודעה "לא ברור אם נשלח" |
| mailto | גיבוי ידני | קישור הורדה חתום ל-7 ימים (mailto לא מצרף קבצים) |

## 5. קבצים

`src/lib/files` כותב וקורא ZIP (‏DecompressionStream), ‏DOCX, ‏XLSX ו-CSV (כולל Windows-1255) בלי תלויות חיצוניות.
תצוגת Word עוברת דרך mammoth ומנקה allow-list (`lib/sanitizeHtml.ts`): רק תגיות ותכונות מותרות, קישורים בטוחים, ותמונות רק כ-`data:image` רסטר.

## 6. AI

אין יכולות AI במערכת, וזו החלטה מכוונת (AUDIT ממצא 17): המערכת לא מבצעת התאמות, ושאר התהליכים דטרמיניסטיים.
