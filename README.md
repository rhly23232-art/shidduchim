# שידוכים — ניהול והתאמה חכמה

אפליקציית ווב מלאה (RTL, עברית) לניהול, סינון והתאמה של מועמדים — בחורים ובחורות.
React 18 + TypeScript (strict) + Vite · Tailwind + shadcn/ui (Radix) · TanStack Table/Virtual/Query ·
React Hook Form + Zod · Supabase (Postgres, Auth, Storage, Edge Functions) · framer-motion · @hebcal/core.

## מה במערכת

- **טבלאות בחורים ובחורות** — סינון משולב (גיל, עיר/אזור, ישיבה/סמינר, עדה) שנשמר בכתובת, מיון, חיפוש חופשי וייצוא לאקסל.
- **כרטיס מועמד** — 4 חלקים, עריכה ומחיקה, ניהול רזומה (צפייה בתוך האפליקציה ל-PDF, תמונה ו-Word; הורדה; שליחה במייל עם קובץ מצורף).
- **סרגל צד** — מעבר בין הטבלאות, פנל רעיונות ורשימת כל המועמדים עם חיפוש.
- **פנל רעיונות** — רשימות חופשיות עם הצמדה, סימון כטופל וקישור למועמדים.
- **מסמכים** — טופס רזומה: מילוי חופשי במערכת (טיוטה נשמרת, מילוי אוטומטי מכרטיס מועמד), הורדה כקובץ Word,
  שמירה כרזומה בכרטיס, ושליחת טופס ריק במייל לאם המועמד/ת למילוי.
- **טבלת רזומה** — כל המועמדים והרזומות: צפייה, הורדה, העלאה, וייצוא כל המועמדים לקובץ Excel (‎.xlsx).
- **חיפוש מהיר** — מועמדים ופעולות מכל מקום.
- **ייבוא מאקסל** — העברת מאגר קיים מקובץ Excel ‏(xlsx) או CSV (כולל קידוד עברי ישן): זיהוי עמודות אוטומטי,
  המרת תאריכים (לועזי / עברי / תאריכי Excel), בדיקה לפני ייבוא, זיהוי כפילויות מול המאגר ובתוך הקובץ
  (דילוג / עדכון / הוספה), ועמודות שלא שויכו נשמרות בהערות.
- **היסטוריית שינויים** — כל שינוי בכרטיס נרשם (שדה, לפני ← אחרי, מתי), עם חזרה למצב שלפני כל שינוי.
- **סל מחזור** — מועמד או רעיון שנמחקו נשמרים 30 יום ומשוחזרים בלחיצה, כולל קובץ הרזומה והקישורים מהרעיונות.
- **גיבוי ושחזור** — קובץ גיבוי מלא (‎.zip: כל הכרטיסים, המשפחה, המחותנים, הרעיונות והרזומות), תזכורת שבועית,
  ושחזור מקובץ שמוסיף רק את מה שחסר.
- **החשבון שלי** — ייצוא מלא, מחיקת כל הנתונים ומחיקת החשבון (עם הקלדת "מחיקה" וסיסמה).
- **עריכה מקבילה מוגנת** — שמירה על כרטיס שהשתנה בינתיים בחלון אחר מתריעה ולא דורסת.
- **דוח תקלות לתמיכה** — בדיקות תקינות חיות ושגיאות אחרונות, ללא פרטי מועמדים.
- **מערכת עיצוב (Calm Productivity)** — tokens, ספריית רכיבים ותיעוד: [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md); עמוד הדגמה חי ב-`/design-system`.

## מסד הנתונים — שלוש אפשרויות (נבחרת אוטומטית בעלייה)

1. **Supabase** — כשמוגדרים `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY` (הוראות למטה).
2. **מסד הנתונים של claude.ai** — כשהאפליקציה מפורסמת כ-Artifact: הנתונים נשמרים בחשבון claude.ai של המשתמש
   (אזור פרטי — `data/users/<id>/profile/{candidates,ideas}`), קבצי רזומה באחסון הקבצים של הדף.
   הזיהוי הוא חשבון claude.ai עצמו, ולכן אין מסך כניסה. מסד ריק מציע "טעינת נתוני דוגמה" שניתנים להסרה בלחיצה.
3. **הדגמה מקומית** — בכל מצב אחר, בדפדפן בלבד (IndexedDB).

### שליחת מייל בתוך claude.ai

השליחה עוברת דרך חיבור ה-Gmail של המשתמש. החיבור חייב לכלול הרשאת שליחה: אם Gmail חובר בהרשאת קריאה בלבד,
יש לנתק ולחבר אותו מחדש בהגדרות claude.ai ← Connectors ולאשר את כל ההרשאות.

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
2. החילו את המיגרציות — הוראות מלאות לייצור ב-[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (טבלאות, אינדקסים, GRANT, RLS, View, RPC, bucket ומדיניות Storage):
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
| `npm test` | בדיקות יחידה ואינטגרציה (Vitest) |
| `npm run test:e2e` | בדיקות E2E ונגישות (Playwright + axe) — דורש שרת פעיל, ראו `docs/TESTING.md` |
| `npm run verify:rls` | 48 בדיקות בידוד בין חשבונות (כל הטבלאות, View, ‏RPC, ‏Storage, יומן, מיילים, מחיקת חשבון) |
| `npm run verify:filters` | שוויון בין סינון בצד השרת לסינון בצד הלקוח |
| `npm run verify:email` | בדיקות פונקציית המייל מול ספק מדומה |

לאירוח סטטי ללא rewrites (למשל GitHub Pages) בנו עם `VITE_HASH_ROUTER=true`.

## מבנה

```
src/
  components/ui/          ספריית הרכיבים (Button, Field, Segmented, ChoiceGroup, Alert, EmptyState, Dialog, Sheet…)
  components/layout/      Header, SearchBox, UserMenu, Logo
  features/candidates/    CandidatesTable, columns.male.tsx, columns.female.tsx, FilterBar, SampleData,
                          CandidateDetailModal, CandidateForm, filtering.ts
  features/resumes/       ResumeActions, EmailDialog, uploadResume.ts, sendResumeEmail.ts
  hooks/                  useCandidates, useFilters (מסונכרן ל-URL), useDebounced, …
  lib/files/              zip/unzip, docx, xlsx, readSheet — יצירה וקריאה של Word/Excel/CSV ללא תלות חיצונית
  lib/api/journaled.ts    רישום אוטומטי של כל שמירה/מחיקה להיסטוריה ולסל המחזור
  lib/                    supabase.ts, api/ (Supabase / מסד claude.ai / הדגמה), hebrewDate.ts, age.ts,
                          validators.ts, strings.he.ts (כל מחרוזות הממשק)
  pages/                  Login, Home, Candidates, Ideas, DesignSystem (Showcase)
docs/
  ARCHITECTURE.md         ארכיטקטורה, מסד, אינטגרציות
  DEPLOYMENT.md           פריסה לייצור, משתני סביבה, סודות, rollback
  TESTING.md              סוגי הבדיקות, הרצה ו-CI
  OPERATIONS.md           רישום שגיאות, דוח תמיכה, תפעול
  AUDIT.md                ביקורת המערכת וממצאיה
  RELEASE_READINESS.md    דוח מוכנות לשחרור
  DESIGN_SYSTEM.md        עקרונות, tokens, רכיבים, RTL ונגישות
supabase/
  migrations/             הסכמה המלאה
  functions/send-resume-email/   שליחת רזומה כקובץ מצורף (Resend)
  seed.sql                נוצר אוטומטית מ-src/data/seedData.ts
scripts/                  generate-seed.ts, verify-rls.ts, verify-email-function.ts, verify-server-filters.ts
tests/                    unit/, integration/ (Vitest), e2e/ (Playwright)
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
