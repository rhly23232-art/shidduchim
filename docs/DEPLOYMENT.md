# פריסה לייצור — שידוכים

> כל צעד במסמך זה נוגע בסביבת ייצור, ויש לבצע אותו רק באישור בעל המערכת.

## 1. דרישות

- פרויקט Supabase לייצור (Postgres, ‏Auth, ‏Storage, ‏Edge Functions).
- חשבון Resend עם דומיין מאומת (SPF/DKIM) לשליחת מייל.
- אירוח סטטי עם rewrite של כל הנתיבים ל-`index.html` (לדוגמה Netlify, ‏Vercel, ‏Cloudflare Pages). בלי rewrites יש לבנות עם `VITE_HASH_ROUTER=true`.
- Node 20 ומעלה.

## 2. משתני סביבה (build)

| משתנה | חובה | תיאור |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | כן | כתובת הפרויקט. בלעדיו האפליקציה עולה במצב הדגמה |
| `VITE_SUPABASE_ANON_KEY` | כן | מפתח anon (ציבורי; ההגנה היא RLS) |
| `VITE_ERROR_ENDPOINT` | לא | כתובת שאליה נשלחות שגיאות (JSON, ‏sendBeacon). מידע אישי מוסר לפני השליחה |
| `VITE_HASH_ROUTER` | לא | `true` לאירוח ללא rewrites |
| `VITE_SUPPORT_EMAIL` | לא | כתובת לפניות תמיכה (חלון "תמיכה ועזרה"). בלעדיה מוצגים רק השאלות הנפוצות ודוח התקלות |
| `VITE_PUBLIC_URL` | לא | הכתובת הציבורית של האפליקציה להזמנת חבר. ברירת מחדל: כתובת האתר עצמו |

אין להכניס ל-build מפתח `service_role` או סודות אחרים.

## 3. סודות ה-Edge Function

```bash
npx supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="שידוכים <noreply@your-domain>"
```

```bash
npx supabase secrets set ALLOWED_ORIGINS=https://your-app-domain
```

רשות: `EMAIL_LIMIT_HOUR` (ברירת מחדל 30), ‏`EMAIL_LIMIT_DAY` (200), ‏`PROVIDER_TIMEOUT_MS` (20000).
אם `ALLOWED_ORIGINS` לא מוגדר, ברירת המחדל היא `*` (הפונקציה עדיין מחייבת JWT).

## 4. הגדרות Auth בייצור (לוח הבקרה של Supabase)

- **Confirm email: פעיל.** מקומית הוא כבוי לצורכי פיתוח בלבד.
- אורך סיסמה מינימלי 8; ‏Secure password change פעיל (כמו ב-`config.toml`).
- Site URL ו-Redirect URLs לדומיין האפליקציה.
- SMTP מותאם (Resend) למיילי אימות ואיפוס סיסמה.

## 5. סדר פריסה

1. **גיבוי:** אם יש נתונים בפרויקט, גבו את המסד (Backups ‏/ `pg_dump`) לפני כל מיגרציה.
2. **מיגרציות:**
   ```bash
   npx supabase link --project-ref <project>
   ```
   ```bash
   npx supabase db push
   ```
   מוחלות 8 מיגרציות לפי סדר (ראו `docs/ARCHITECTURE.md`). כולן מוסיפות בלבד, ואינן מוחקות נתונים קיימים.
3. **אימות בידוד:** מומלץ להריץ `npm run verify:rls` מול פרויקט staging זהה, ולא מול ייצור (הסקריפט יוצר חשבונות בדיקה).
4. **Edge Function:**
   ```bash
   npx supabase functions deploy send-resume-email
   ```
   בדיקה: בקשת GET לפונקציה מחזירה `{"ok":true,"configured":true}`. הבדיקה זמינה גם מתוך האפליקציה: תפריט משתמש ← "תמיכה ועזרה" ← "הורדת דוח תקלות".
5. **build ופרסום:**
   ```bash
   npm ci && npm run build
   ```
   ומעלים את `dist/` לאירוח.
6. **בדיקת עשן:** הרשמה, הוספת מועמד, העלאת רזומה, שליחת מייל לכתובת בדיקה, גיבוי, ודוח תמיכה.
   ב-seed יש חשבון הדגמה (`demo@shidduchim.local`). **אין להריץ `seed.sql` בייצור.**

## 6. Rollback

- **קוד:** פריסה מחדש של build קודם (כל commit ב-`main` ניתן לבנייה). נקודות שמירה: הענפים `backup/pre-design-system` ו-`backup/before-changes-review`.
- **מסד:** המיגרציות מוסיפות טבלאות, עמודות ופונקציות בלבד. גרסת לקוח ישנה ממשיכה לעבוד מול הסכמה החדשה. לכן ברוב המקרים rollback של קוד מספיק, בלי לגעת במסד. שחזור מסד מלא נעשה מהגיבוי של צעד 1.
- **Edge Function:** ‏`functions deploy` מגרסה קודמת, או הסרת הסוד `RESEND_API_KEY` לניתוק מיידי. האפליקציה תמשיך להציע mailto.
