# מערכת העיצוב — Calm Productivity

מסמך זה הוא מקור האמת לעיצוב של "שידוכים". כל רכיב, מסך או שינוי עתידי צריך להיבנות לפיו.
עמוד חי עם כל הרכיבים והמצבים: **`/design-system`** (תפריט המשתמש ← "מערכת העיצוב").

---

## 1. עקרונות

| עיקרון | בפועל |
| --- | --- |
| **פשטות** | פעולה ראשית אחת לכל אזור (כפתור `primary` אחד). שאר הפעולות `outline` / `ghost`. בלי אפשרויות מיותרות. |
| **עקביות** | אותה פעולה = אותו רכיב, אותו מראה ואותה התנהגות בכל מסך. לא יוצרים גרסה מקומית לרכיב שקיים. |
| **ניקיון** | רקע `#FAFAF9`, משטחים לבנים, גבול דק `#E8E9EC`, צללים מינימליים, צבע רק כשיש לו משמעות. |
| **פונקציה לפני קישוט** | אין גרדיאנטים, טבעות דקורטיביות או אנימציות ראווה. כל אלמנט משרת מטרה. |
| **שימור התנהגות** | העיצוב לא משנה נתונים, הרשאות או תהליכים. |

## 2. צבעים

כל הצבעים מוגדרים כמשתני CSS ב-`src/index.css` (ערכי HSL) וממופים ל-Tailwind ב-`tailwind.config.ts`.
**אסור** להשתמש בצבע גולמי (`#…`, `bg-blue-500`) ברכיב. **אין צבע כחול במערכת** — הפלטה כולה חמה: בז׳, חום אפרפר ואפור חמים.

| Token | Hex | שימוש |
| --- | --- | --- |
| `background` | `#F8F5EF` | רקע האפליקציה — בז׳ עדין |
| `card` / `popover` | `#FEFDFC` | משטחי עבודה, חלוניות, תפריטים (לבן חמים) |
| `secondary` / `muted` | `#F1ECE4` | רקע משני, ריחוף, כפתור משני |
| `secondary-hover` | — | ריחוף על רקע משני |
| `foreground` | `#2B2622` | טקסט ראשי (כמעט שחור, חמים) |
| `muted-foreground` | `#6D665F` | טקסט משני — אפור חמים, עומד ב-WCAG AA (5.2:1 על הרקע) |
| `brand` | `#91806E` | צבע ההדגשה — חום אפרפר: מחוון פעיל, טבעת פוקוס, אייקוני מיון |
| `primary` | `#6C5D51` | מילוי כפתור ראשי וקישורים — חום אפרפר כהה (6.2:1 עם טקסט בהיר) |
| `primary-hover` | — | ריחוף על כפתור ראשי |
| `accent` / `accent-foreground` | `#EEE7DD` / `#57493D` | מצב **נבחר / פעיל** (פריט ניווט, אפשרות נבחרת, מסנן פעיל) |
| `border` | `#E6E0D6` | גבולות ומפרידים |
| `input` / `input-hover` | `#D3CBC0` | גבול שדות טופס ובקרות |
| `ring` | `#8E7A67` | טבעת פוקוס |
| `success` (+`-soft`) | ירוק מאופק | הצלחה, "טופל", "פעיל/ה" |
| `warning` (+`-soft`, `-dot`) | כתום עדין | אזהרה, "בתהליך" |
| `destructive` (+`-soft`, `-hover`) | אדום ברור | שגיאה, מחיקה |
| `info` (+`-soft`) | חום חמים | מידע, "מאורס/ת" |
| `overlay` | — | רקע חלונות (40% שקיפות) |

**מצבי אינטראקציה:** Hover = `secondary` (רכיבים ניטרליים) או `primary-hover`; Active = הזזה של 1px;
Focus = `ring` 2px עם offset; Disabled = 50% אטימות + חסימת לחיצה; Selected = `accent` + `accent-foreground`
(+ גבול `brand` בבקרות בחירה).

## 3. טיפוגרפיה

משפחה אחת: **Heebo** (400/500/600/700), נטענת מ-Google Fonts ב-`index.html`.
סולם הגדלים **מחליף** את ברירות המחדל של Tailwind — `text-sm`, `text-[13px]` וכו' לא קיימים.

| Class | גודל / שורה | משקל | שימוש |
| --- | --- | --- | --- |
| `text-display` | 32/40 | 700 | כותרת ראווה (נדיר) |
| `text-h1` | 24/32 | 700 | שם מועמד בכרטיס, כותרת טופס |
| `text-h2` | 20/28 | 600 | כותרת עמוד (Header), כותרת חלון |
| `text-h3` | 18/26 | 600 | כותרת אזור בטופס, מצב ריק |
| `text-h4` | 16/24 | 600 | כותרת כרטיס / תת-אזור |
| `text-body-lg` | 16/26 | 400 | טקסט מוגדל, כפתור `lg` |
| `text-body` | 14/22 | 400 | ברירת המחדל |
| `text-body-sm` | 13/20 | 400 | מידע משני, תאי הערות |
| `text-caption` | 12/16 | 400 | תוויות משנה, תגיות, זמנים |
| `text-label` | 13/20 | 500 | תוויות שדות |
| `text-button` | 14/20 | 500 | כפתורים |
| `text-table` | 14/20 | 400 | תוכן טבלאות (עם `tabular` למספרים) |

מספרים בטבלאות ובמונים: הוסיפו `tabular` (ספרות ברוחב קבוע).

> `cn()` (`src/lib/utils.ts`) מוגדר עם tailwind-merge שמכיר את הסולם — כדי ש-`text-h2` לא ייחשב בטעות לצבע.

## 4. ריווח

יחידת בסיס 4px. משתמשים רק בערכים: **4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64**
(`1 · 2 · 3 · 4 · 5 · 6 · 8 · 10 · 12 · 16` ב-Tailwind). אין `1.5`, `2.5`, `3.5` בריווח.

| הקשר | ערך |
| --- | --- |
| ריווח צדדי של עמוד | `px-4` (מובייל) · `md:px-8` |
| בין אזורים בעמוד | `space-y-6` – `space-y-12` |
| בתוך כרטיס | `p-4` – `p-6` |
| בין שדות טופס | `gap-4` |
| תווית ↔ שדה | `gap-2` |

## 5. פינות

| Token | ערך | שימוש |
| --- | --- | --- |
| `rounded-sm` | 6px | אלמנטים קטנים: תיבת סימון, כפתורים בתוך Segmented, Tooltip |
| `rounded-md` | 8px | כפתורים, שדות, פריטי תפריט, פריטי ניווט |
| `rounded-lg` | 12px | כרטיסים, טבלאות, חלונות, חלוניות צפות |
| `rounded-full` | — | תגיות, צ'יפים, אווטאר, מתג |

## 6. צללים

| Token | שימוש |
| --- | --- |
| `shadow-sm` | כפתורים מלאים/מסגרת, לשונית נבחרת |
| `shadow-md` | תפריטים, Popover, ריחוף על כרטיס ניווט |
| `shadow-lg` | חלונות, מגירות, Toast |

כרטיסים וטבלאות — **גבול בלבד**, בלי צל.

## 7. נקודות שבירה ופריסה

`sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536` (ברירות המחדל של Tailwind).

- **≥1024px:** Sidebar קבוע (17.5rem), ניתן לכיווץ לפס אייקונים (4.5rem) בכפתור ההמבורגר.
- **<1024px:** Sidebar נפתח כמגירה מימין.
- **Header** קבוע (64px): המבורגר · כותרת העמוד · חיפוש מהיר · "הוספת מועמד/ת" · תפריט משתמש.
- **טבלאות:** ≥768px טבלה מלאה (גלילה אופקית פנימית בין 768–1023), <768px כרטיסים.
- **סינון:** ≥768px שורת מסננים; <768px כפתור "סינון" שפותח מגירה תחתונה.
- אין גלילה אופקית של העמוד בשום רוחב (נבדק אוטומטית).

## 8. רכיבים (`src/components/ui`)

| רכיב | קובץ | וריאציות / הערות |
| --- | --- | --- |
| **Button** | `button.tsx` | `primary` · `outline` (ברירת מחדל) · `secondary` · `ghost` · `destructive` · `link`; גדלים `sm` 32 · `md` 40 · `lg` 44 · `icon` 36 · `icon-sm` 32; `loading` מציג ספינר וחוסם לחיצה |
| **Input / Textarea / NativeSelect** | `input.tsx` | מראה משותף `fieldBase`; גובה 40; מצבי hover/focus/invalid/disabled |
| **Field** | `field.tsx` | תווית + שדה + טקסט עזר/שגיאה, כולל `aria-describedby`, `aria-invalid`, חובה (`*` + טקסט לקורא מסך) |
| **Label** | `label.tsx` | `text-label` |
| **Checkbox / CheckboxIndicator** | `checkbox.tsx` | `role="checkbox"`; Indicator לשימוש בתוך רשימות בחירה |
| **Switch** | `switch.tsx` | `role="switch"` |
| **ChoiceGroup** | `choice-group.tsx` | קבוצת Radio בכפתורים (עדה), חצים לפי RTL, `allowDeselect` |
| **Segmented** | `segmented.tsx` | לשוניות (`tablist`) או בחירה (`radiogroup`); בחורים/בחורות/הכל, סוג בטופס |
| **RangeSlider** | `slider.tsx` | טווח גיל |
| **HebrewDatePicker** | `features/candidates/` | תאריך עברי ↔ לועזי |
| **SearchBox** | `components/layout/` | חיפוש מושהה 250ms, `/` למיקוד, ניקוי |
| **filterTriggerClass / FilterCount / FilterChevron** | `filter-trigger.tsx` | מראה אחיד לכל כפתורי הסינון; מצב פעיל = `accent` |
| **Chip** | `chip.tsx` | מסנן פעיל עם הסרה |
| **Badge** | `badge.tsx` | `neutral` · `accent` · `info` · `success` · `warning` · `destructive` |
| **Card** | `card.tsx` | Card + Header/Title/Description/Content/Footer |
| **EmptyState** | `empty-state.tsx` | אייקון, כותרת, הסבר ופעולה אחת; `tone="destructive"` לשגיאה |
| **Alert** | `alert.tsx` | `info` · `success` · `warning` · `destructive` · `neutral`; אייקון + טקסט, `action` אופציונלי |
| **Spinner / Skeleton / Progress** | `spinner.tsx` · `skeleton.tsx` · `progress.tsx` | מצבי טעינה |
| **Tooltip** | `tooltip.tsx` | רקע כהה, 13px; לכל כפתור-אייקון |
| **Dialog** | `dialog.tsx` | Header / Body (גלילה) / Footer; Esc, focus trap, החזרת פוקוס |
| **ConfirmDialog** | `alert-dialog.tsx` | אישור לפני כל פעולה הרסנית |
| **Sheet (Drawer)** | `sheet.tsx` | `end` (טופס), `start` (ניווט במובייל), `bottom` (מסננים במובייל) |
| **Popover / DropdownMenu / Command** | `popover.tsx` · `dropdown-menu.tsx` · `command.tsx` | צפים עם `shadow-md`; פריט הרסני ב-`destructive` |
| **ComposeEmailDialog** | `features/resumes/` | חלון שליחת מייל אחיד עם קובץ מצורף (Gmail / שרת / ידני) — לכל שליחה במערכת |
| **Toast** | `App.tsx` (sonner, `unstyled`) | אייקון צבעוני לפי סוג, כפתור סגירה |

### כללי שימוש

- **כפתור ראשי אחד** בכל אזור (Header: "הוספת מועמד/ת"; חלון: "שמירה"/"עריכה").
- **כפתור-אייקון** תמיד עם `aria-label` ו-Tooltip.
- **מחיקה:** `ghost` אדום בפעולות שורה/כרטיס, `destructive` רק בכפתור האישור של ConfirmDialog.
- **שדה טופס:** תמיד דרך `Field` (או Label+`htmlFor`), לעולם לא placeholder במקום תווית.
- **מצב ריק / שגיאה:** תמיד `EmptyState` בתוך `Card`, עם פעולה שמובילה הלאה.
- **הודעת מערכת זמנית:** Toast. **הודעה קבועה בעמוד:** Alert.

## 9. אנימציה

| Token | זמן | שימוש |
| --- | --- | --- |
| `duration-fast` | 150ms | hover, focus, צבעים |
| `duration-base` | 200ms | פתיחת חלון/תפריט, מתג, כיווץ Sidebar |
| `duration-slow` | 250ms | מגירות |

עקומה: `ease-out` (`cubic-bezier(0.22, 1, 0.36, 1)`). `prefers-reduced-motion` מבטל אנימציות גלובלית
(`index.css`) ו-framer-motion מכבד אותו (`MotionConfig reducedMotion="user"`).

## 10. RTL ועברית

- `dir="rtl"` ו-`lang="he"` ברמת המסמך; `DirectionProvider` של Radix מוגדר ל-RTL.
- **רק מאפיינים לוגיים:** `ms/me`, `ps/pe`, `start/end`, `border-s/e`, `rounded-ss/se`, `text-start/end`.
  לא `ml/mr/pl/pr/left/right` (חריג: מרכוז חלון עם `left-1/2 -translate-x-1/2`).
- מקלדת: בלשוניות וקבוצות בחירה **חץ שמאלה = הבא** (מחושב מ-`direction` בפועל).
- תוכן LTR: דוא"ל, URL, מספרי טלפון, גדלי קבצים — `dir="ltr"` נקודתי; שמות קבצים — `dir="auto"`.
- אייקונים כיווניים (חץ "כניסה", חץ פתיחת אזור) מצוירים לכיוון RTL; אייקונים לא כיווניים לא הופכים.
- Sidebar בצד ימין, מגירת טופס משמאל (סוף השורה), Tooltip בסרגל המכווץ נפתח שמאלה.

## 11. נגישות (WCAG 2.2 AA)

- ניגודיות: כל צירופי הטקסט עוברים 4.5:1 (נבדק ב-axe-core בכל המסכים והחלונות).
- פוקוס גלוי בכל רכיב אינטראקטיבי (`ring` 2px).
- תוויות לכל שדה ולכל כפתור-אייקון; שגיאות עם `role="alert"` ו-`aria-describedby`.
- משמעות לא מועברת בצבע בלבד: סטטוס = תגית עם טקסט; נקודת סטטוס ברשימה מלווה בטקסט לקורא מסך.
- אזורי לחיצה ≥ 24px (רוב הבקרות 32–40px).
- קישור "דילוג לתוכן הראשי", כותרות היררכיות, `aria-current` בניווט, `aria-sort` בטבלה.

## 12. יצירת רכיב חדש — צ'קליסט

1. בדקו אם רכיב קיים עונה על הצורך (גם עם וריאציה חדשה) — **הרחבה עדיפה על רכיב חדש**.
2. רכיב משותף → `src/components/ui/`, שם קובץ ב-kebab-case, ייצוא בשם.
3. צבעים, גדלים, פינות וצללים **רק מה-tokens**. אין ערכים שרירותיים (`[13px]`, `#hex`).
4. קבלו `className` ומזגו עם `cn()`.
5. הגדירו מצבים: hover, focus-visible, active, disabled, invalid/selected לפי הצורך.
6. מקלדת ו-ARIA: role מתאים, תווית, ניווט חצים RTL אם זו קבוצה.
7. RTL: רק מאפיינים לוגיים.
8. הוסיפו דוגמה לעמוד `/design-system` (`src/pages/DesignSystem.tsx`) ושורה לטבלה בסעיף 8.
9. הריצו `npm run typecheck`, `npm run lint`, ובדקו בעמוד `/design-system` ובמסך האמיתי.
