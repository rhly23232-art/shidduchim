# שידוכים — ניהול והתאמה חכמה

אפליקציית ווב מלאה (RTL, עברית) לניהול, סינון והתאמה של מועמדים — בחורים ובחורות.
React 18 + TypeScript (strict) + Vite · Tailwind + shadcn/ui (Radix) · TanStack Table/Virtual/Query ·
React Hook Form + Zod · Supabase (Postgres, Auth, Storage, Edge Functions) · framer-motion · @hebcal/core.

## הרצה מהירה

```bash
npm install
npm run dev
```

**בלי הגדרות Supabase** האפליקציה רצה ב**מצב הדגמה**: הנתונים נשמרים בדפדפן (IndexedDB) והכפתור
"כניסה לחשבון ההדגמה" נכנס לחשבון עם 20 מועמדים לדוגמה. כל חשבון שנרשם רואה רק את המועמדים שלו.

### חיבור ל-Supabase

1. צרו פרויקט ב-Supabase והעתיקו את `.env.example` ל-`.env.local`:
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
2. החילו את המיגרציה (טבלאות, אינדקסים, GRANT, RLS, View, RPC, bucket ומדיניות Storage):
   ```bash
   npx supabase link --project-ref <project>
   npx supabase db push
   ```
3. (רשות) נתוני דוגמה: `supabase/seed.sql` יוצר את החשבון `demo@shidduchim.local` / `shidduch123`
   עם 10 בחורים ו-10 בחורות. מקומית הוא נטען אוטומטית ב-`npx supabase db reset`.
4. שליחת מייל עם קובץ מצורף (Resend):
   ```bash
   npx supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="שידוכים <noreply@your-domain.com>"
   npx supabase functions deploy send-resume-email
   ```
   בלי הפונקציה עדיין זמינה האפשרות "פתיחה בתוכנת הדואר" (mailto) עם קישור הורדה חתום ל-7 ימים
   (mailto אינו יכול לצרף קבצים — הדבר מצוין בממשק).

### פיתוח מקומי מלא

```bash
npx supabase start          # Postgres + Auth + Storage + Functions מקומיים, כולל seed
npm run db:types            # יצירת src/lib/database.types.ts מהסכמה
npm run db:seed             # יצירה מחדש של supabase/seed.sql מתוך src/data/seedData.ts
npm run verify:rls          # בדיקת RLS עם שני חשבונות (דורש .env.local)
```

## סקריפטים

| פקודה | תיאור |
| --- | --- |
| `npm run dev` | שרת פיתוח |
| `npm run build` | בדיקת טיפוסים + build לייצור |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run verify:rls` | 19 בדיקות בידוד בין חשבונות (טבלאות, RPC ו-Storage) |

לאירוח סטטי ללא rewrites (למשל GitHub Pages) בנו עם `VITE_HASH_ROUTER=true`.

## מבנה

```
src/
  components/ui/          רכיבי shadcn (Button, Dialog, Sheet, Popover, Command, Slider…)
  components/layout/      Header, SearchBox, UserMenu, Logo
  features/candidates/    CandidatesTable, columns.male.tsx, columns.female.tsx, FilterBar,
                          CandidateDetailModal, CandidateForm, filtering.ts
  features/resumes/       ResumeActions, EmailDialog, uploadResume.ts, sendResumeEmail.ts
  hooks/                  useCandidates, useFilters (מסונכרן ל-URL), useDebounced, …
  lib/                    supabase.ts, api/ (Supabase + מצב הדגמה), hebrewDate.ts, age.ts,
                          validators.ts, strings.he.ts (כל מחרוזות הממשק)
  pages/                  Login, Dashboard
supabase/
  migrations/             הסכמה המלאה
  functions/send-resume-email/   שליחת רזומה כקובץ מצורף (Resend)
  seed.sql                נוצר אוטומטית מ-src/data/seedData.ts
scripts/                  generate-seed.ts, verify-rls.ts
```

## החלטות עיקריות

- **כל מצב הסינון ב-URL**: `?tab=female&ageMin=23&city=ירושלים&sort=-age&c=<id>` — שורד רענון וניתן לשיתוף,
  כולל פתיחת כרטיס מועמד ספציפי. "אחורה" במובייל סוגר את הכרטיס.
- **סינון מיידי**: עד 5,000 מועמדים — רשימה אחת במטמון וסינון/מיון בצד הלקוח. מעל — מעבר אוטומטי לסינון
  בצד השרת (PostgREST) עם ספירה מדויקת. יותר מ-100 שורות — וירטואליזציה (TanStack Virtual).
- **שמירה אטומית**: `save_candidate(payload)` (SECURITY INVOKER) שומר מועמד + פרטי משפחה + מחותנים
  בטרנזקציה אחת, ו-RLS ממשיך לחול.
- **גיל מחושב** ב-`candidates_view` (`security_invoker = true` כדי שה-RLS יחול גם על ה-View).
- **רזומה**: bucket פרטי `resumes` (10MB, PDF/DOCX/PNG/JPG) בנתיב `{owner_id}/{candidate_id}/…`;
  בדיקה בצד הלקוח כוללת גם בדיקת חתימת קובץ (magic bytes); העלאה עם התקדמות אמיתית (XHR);
  הורדה בקישור חתום ל-60 שניות; החלפה מבקשת אישור.
- **נגישות**: Radix (focus trap, Esc), טאבים לפי WAI-ARIA, תוויות עבריות לכל כפתור אייקון,
  החזרת פוקוס אחרי סגירת חלונות, קיצור `/` לחיפוש. axe-core (WCAG 2.1 AA): 0 הפרות.
