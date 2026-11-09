import { Download, Inbox, Mail, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Chip } from '@/components/ui/chip'
import { ChoiceGroup } from '@/components/ui/choice-group'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { FilterChevron, FilterCount, filterTriggerClass } from '@/components/ui/filter-trigger'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Tooltip } from '@/components/ui/tooltip'
import { SearchBox } from '@/components/layout/SearchBox'
import { HebrewDatePicker } from '@/features/candidates/HebrewDatePicker'
import { StatusBadge } from '@/features/candidates/StatusBadge'

/*
 * Design System Showcase — internal documentation page (/design-system).
 * Renders the real components with their variants and states. Not part of the main navigation.
 */

const COLORS: { token: string; hex: string; use: string }[] = [
  { token: 'background', hex: '#F8F5EF', use: 'רקע ראשי — בז׳ עדין' },
  { token: 'card', hex: '#FEFDFC', use: 'משטחי עבודה, חלוניות, תפריטים' },
  { token: 'secondary', hex: '#F1ECE4', use: 'רקע משני, ריחוף, אזורים שקטים' },
  { token: 'foreground', hex: '#2B2622', use: 'טקסט ראשי' },
  { token: 'muted-foreground', hex: '#6D665F', use: 'טקסט משני (AA)' },
  { token: 'brand', hex: '#91806E', use: 'הדגשה בחום אפרפר: מחוונים, פוקוס' },
  { token: 'primary', hex: '#6C5D51', use: 'כפתור ראשי וקישורים (AA עם לבן)' },
  { token: 'accent', hex: '#EEE7DD', use: 'מצב נבחר / פעיל' },
  { token: 'border', hex: '#E6E0D6', use: 'גבולות ומפרידים' },
  { token: 'input', hex: '#D3CBC0', use: 'גבול שדות טופס' },
  { token: 'success', hex: '#366345', use: 'הצלחה' },
  { token: 'warning', hex: '#8A4C0F', use: 'אזהרה' },
  { token: 'destructive', hex: '#B93131', use: 'שגיאה / מחיקה' },
  { token: 'info', hex: '#675342', use: 'מידע' },
]

const TYPE: { cls: string; name: string; spec: string }[] = [
  { cls: 'text-display', name: 'Display', spec: '32/40 · 700' },
  { cls: 'text-h1', name: 'H1', spec: '24/32 · 700' },
  { cls: 'text-h2', name: 'H2', spec: '20/28 · 600' },
  { cls: 'text-h3', name: 'H3', spec: '18/26 · 600' },
  { cls: 'text-h4', name: 'H4', spec: '16/24 · 600' },
  { cls: 'text-body-lg', name: 'Body Large', spec: '16/26 · 400' },
  { cls: 'text-body', name: 'Body', spec: '14/22 · 400' },
  { cls: 'text-body-sm', name: 'Body Small', spec: '13/20 · 400' },
  { cls: 'text-caption', name: 'Caption', spec: '12/16 · 400' },
  { cls: 'text-label', name: 'Label', spec: '13/20 · 500' },
  { cls: 'text-button', name: 'Button', spec: '14/20 · 500' },
  { cls: 'text-table tabular', name: 'Table Text', spec: '14/20 · ספרות טבלאיות' },
]

const SPACING = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64]

const SECTIONS = [
  ['principles', 'עקרונות'],
  ['colors', 'צבעים'],
  ['type', 'טיפוגרפיה'],
  ['spacing', 'ריווח, פינות וצללים'],
  ['buttons', 'כפתורים'],
  ['inputs', 'שדות קלט'],
  ['navigation', 'ניווט ובחירה'],
  ['display', 'הצגת מידע'],
  ['overlays', 'חלוניות ותפריטים'],
  ['feedback', 'משוב ומצבים'],
] as const

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`ds-${id}`} aria-labelledby={`ds-${id}-h`} className="scroll-mt-24 space-y-4">
      <h2 id={`ds-${id}-h`} className="text-h2 text-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  )
}

const Row = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3">{children}</div>
)

export default function DesignSystemPage() {
  const [check, setCheck] = useState(true)
  const [sw, setSw] = useState(false)
  const [choice, setChoice] = useState<'a' | 'b' | 'c' | null>('a')
  const [seg, setSeg] = useState<'male' | 'female' | 'all'>('male')
  const [q, setQ] = useState('')
  const [date, setDate] = useState<string>('2003-02-14')
  const [dialog, setDialog] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [chips, setChips] = useState(['ירושלים', 'בני ברק', 'גיל 20–25'])

  return (
    <main id="main" className="mx-auto w-full max-w-5xl space-y-12 px-4 pb-24 pt-6 md:px-8">
      <header className="space-y-3">
        <p className="text-body text-muted-foreground">
          Calm Productivity — שפה עיצובית רגועה, ברורה ומדויקת: רקע בז׳ עדין והדגשות בחום אפרפר. כל
          הרכיבים בעמוד זה הם הרכיבים האמיתיים של המערכת. התיעוד המלא:{' '}
          <span dir="ltr">docs/DESIGN_SYSTEM.md</span>
        </p>
        <nav aria-label="תוכן העמוד" className="flex flex-wrap gap-2">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#ds-${id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(`ds-${id}`)?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="rounded-md border border-border bg-card px-3 py-1 text-body-sm text-foreground transition-colors duration-fast hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <Section id="principles" title="עקרונות">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            ['פשטות', 'פעולה אחת ראשית בכל אזור, היררכיה ברורה, בלי עומס.'],
            ['עקביות', 'אותה פעולה נראית ומתנהגת אותו דבר בכל מסך.'],
            ['ניקיון', 'רקע בהיר, גבולות עדינים, צללים מינימליים, צבע במשורה.'],
            ['פונקציה לפני קישוט', 'כל אלמנט משרת מטרה; אנימציות קצרות (150–250ms) בלבד.'],
          ].map(([t, d]) => (
            <Card key={t}>
              <CardHeader>
                <CardTitle>{t}</CardTitle>
                <CardDescription>{d}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="colors" title="צבעים">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COLORS.map((c) => (
            <li
              key={c.token}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <span
                className="size-10 shrink-0 rounded-md border border-border"
                style={{ background: `hsl(var(--${c.token}))` }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-body font-medium text-foreground">
                  <span dir="ltr">{c.token}</span>
                  <span className="tabular text-caption text-muted-foreground" dir="ltr">
                    {c.hex}
                  </span>
                </p>
                <p className="truncate text-caption text-muted-foreground">{c.use}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="type" title="טיפוגרפיה — Heebo">
        <Card>
          <ul className="divide-y divide-border">
            {TYPE.map((t) => (
              <li key={t.name} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-5 py-3">
                <span className="w-44 shrink-0 text-caption text-muted-foreground" dir="ltr">
                  {t.name} · {t.spec}
                </span>
                <span className={`${t.cls} min-w-0 text-foreground`}>
                  שידוך טוב מתחיל בסדר טוב 1234
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section id="spacing" title="ריווח, פינות וצללים">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Demo title="סולם ריווח (4px)">
            <ul className="space-y-2">
              {SPACING.map((n) => (
                <li key={n} className="flex items-center gap-3">
                  <span className="tabular w-8 text-caption text-muted-foreground">{n}</span>
                  <span className="h-2 rounded-sm bg-brand" style={{ width: n * 2 }} aria-hidden />
                </li>
              ))}
            </ul>
          </Demo>
          <Demo title="פינות">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['rounded-sm', 'Small · 6'],
                ['rounded-md', 'Medium · 8'],
                ['rounded-lg', 'Large · 12'],
                ['rounded-full', 'Full'],
              ].map(([cls, l]) => (
                <div key={cls} className="flex flex-col items-center gap-2">
                  <span className={`size-12 border border-input bg-secondary ${cls}`} aria-hidden />
                  <span className="text-caption text-muted-foreground" dir="ltr">
                    {l}
                  </span>
                </div>
              ))}
            </div>
          </Demo>
          <Demo title="צללים">
            <div className="grid grid-cols-3 gap-3">
              {['shadow-sm', 'shadow-md', 'shadow-lg'].map((cls) => (
                <div key={cls} className="flex flex-col items-center gap-2">
                  <span className={`size-12 rounded-md bg-card ${cls}`} aria-hidden />
                  <span className="text-caption text-muted-foreground" dir="ltr">
                    {cls.replace('shadow-', '')}
                  </span>
                </div>
              ))}
            </div>
          </Demo>
        </div>
      </Section>

      <Section id="buttons" title="כפתורים">
        <Demo title="וריאציות">
          <Row>
            <Button variant="primary">
              <Plus />
              ראשי
            </Button>
            <Button variant="outline">מסגרת (ברירת מחדל)</Button>
            <Button variant="secondary">משני</Button>
            <Button variant="ghost">שקוף</Button>
            <Button variant="destructive">
              <Trash2 />
              מחיקה
            </Button>
            <Button variant="link">קישור</Button>
          </Row>
        </Demo>
        <Demo title="גדלים ומצבים">
          <Row>
            <Button size="sm">קטן</Button>
            <Button>בינוני</Button>
            <Button size="lg">גדול</Button>
            <Button variant="primary" loading>
              שומר…
            </Button>
            <Button disabled>מושבת</Button>
            <Tooltip content="עריכה">
              <Button size="icon" variant="ghost" aria-label="עריכה">
                <Pencil />
              </Button>
            </Tooltip>
            <Tooltip content="הורדה">
              <Button size="icon-sm" aria-label="הורדה">
                <Download />
              </Button>
            </Tooltip>
          </Row>
        </Demo>
      </Section>

      <Section id="inputs" title="שדות קלט">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Demo title="טקסט, מספר וטקסט ארוך">
            <div className="space-y-4">
              <Field label="שם מלא" required hint="שם פרטי ושם משפחה">
                {(id, aria) => <Input id={id} {...aria} placeholder="לדוגמה: יוסף כהן" />}
              </Field>
              <Field label="גובה (ס״מ)" error="יש להזין מספר בין 120 ל-230">
                {(id, aria) => (
                  <Input id={id} {...aria} type="number" defaultValue={300} className="tabular" />
                )}
              </Field>
              <Field label="שדה מושבת">
                {(id, aria) => <Input id={id} {...aria} disabled value="לא ניתן לעריכה" readOnly />}
              </Field>
              <Field label="הערות">{(id, aria) => <Textarea id={id} {...aria} rows={3} />}</Field>
              <Field label="דוא״ל" hint="כתובות, מספרים ו-URL מוצגים משמאל לימין">
                {(id, aria) => (
                  <Input
                    id={id}
                    {...aria}
                    type="email"
                    dir="ltr"
                    className="text-start"
                    defaultValue="name@example.com"
                  />
                )}
              </Field>
            </div>
          </Demo>
          <Demo title="חיפוש, בחירה ותאריך">
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <span className="text-label">חיפוש</span>
                <SearchBox value={q} onChange={setQ} />
              </div>
              <Field label="בחירה מרשימה">
                {(id, aria) => (
                  <NativeSelect id={id} {...aria} defaultValue="active">
                    <option value="active">פנוי/ה</option>
                    <option value="in_process">בתהליך</option>
                    <option value="engaged">מאורס/ת</option>
                  </NativeSelect>
                )}
              </Field>
              <div className="flex flex-col gap-2">
                <span className="text-label">תאריך עברי</span>
                <HebrewDatePicker
                  idPrefix="ds-heb"
                  value={date}
                  onChange={(v) => setDate(v ?? '')}
                />
              </div>
              <Field label="תאריך לועזי">
                {(id, aria) => (
                  <Input
                    id={id}
                    {...aria}
                    type="date"
                    className="tabular"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                )}
              </Field>
              <Row>
                <Checkbox checked={check} onChange={setCheck} label="תיבת סימון">
                  תיבת סימון
                </Checkbox>
                <span className="flex items-center gap-2 text-body">
                  <Switch checked={sw} onChange={setSw} label="מתג" />
                  מתג {sw ? 'פעיל' : 'כבוי'}
                </span>
              </Row>
              <div className="flex flex-col gap-2">
                <span className="text-label">בחירה אחת מתוך כמה (Radio)</span>
                <ChoiceGroup
                  className="grid-cols-3"
                  label="בחירה אחת"
                  value={choice}
                  onChange={setChoice}
                  allowDeselect
                  options={[
                    { value: 'a', label: 'ליטא' },
                    { value: 'b', label: 'חסידות' },
                    { value: 'c', label: 'אחר' },
                  ]}
                />
              </div>
            </div>
          </Demo>
        </div>
      </Section>

      <Section id="navigation" title="ניווט ובחירה">
        <Demo title="לשוניות (Segmented) וכפתורי סינון">
          <div className="space-y-4">
            <Segmented
              label="דוגמת לשוניות"
              value={seg}
              onChange={setSeg}
              items={[
                { value: 'male', label: 'בחורים' },
                { value: 'female', label: 'בחורות' },
                { value: 'all', label: 'הכל' },
              ]}
            />
            <Row>
              <button type="button" className={filterTriggerClass(false)}>
                גיל
                <FilterChevron open={false} />
              </button>
              <button type="button" className={filterTriggerClass(true)}>
                מיקום
                <FilterCount value={2} />
                <FilterChevron open={false} />
              </button>
            </Row>
            <Row>
              {chips.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  removeLabel={`הסרת ${c}`}
                  onRemove={() => setChips((x) => x.filter((v) => v !== c))}
                />
              ))}
              {chips.length === 0 && (
                <Button size="sm" variant="ghost" onClick={() => setChips(['ירושלים', 'בני ברק'])}>
                  החזרת דוגמאות
                </Button>
              )}
            </Row>
          </div>
        </Demo>
      </Section>

      <Section id="display" title="הצגת מידע">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Demo title="תגיות">
            <Row>
              <Badge>ניטרלי</Badge>
              <Badge tone="accent">מוצמד</Badge>
              <Badge tone="info">מידע</Badge>
              <Badge tone="success">טופל</Badge>
              <Badge tone="warning">אזהרה</Badge>
              <Badge tone="destructive">שגיאה</Badge>
              <StatusBadge status="in_process" />
              <StatusBadge status="engaged" />
            </Row>
          </Demo>
          <Demo title="אווטאר, טולטיפ והתקדמות">
            <div className="space-y-4">
              <Row>
                <span className="grid size-9 place-items-center rounded-full bg-accent text-body font-semibold text-accent-foreground">
                  ש
                </span>
                <Tooltip content="הסבר קצר מופיע בריחוף ובפוקוס">
                  <Button size="sm">ריחוף להסבר</Button>
                </Tooltip>
              </Row>
              <Progress value={64} label="התקדמות העלאה" />
              <div className="space-y-2" aria-hidden>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </Demo>
        </div>
        <Demo title="טבלה">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[480px] text-table">
              <caption className="sr-only">דוגמת טבלה</caption>
              <thead>
                <tr>
                  {['שם מלא', 'גיל', 'עיר', 'סטטוס'].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="h-11 border-b border-border px-4 text-start text-body-sm font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['יוסף כהן', 23, 'ירושלים', 'active'],
                  ['משה לוי', 25, 'בני ברק', 'in_process'],
                ].map(([n, a, c, st]) => (
                  <tr
                    key={n as string}
                    className="transition-colors duration-fast hover:bg-secondary/60"
                  >
                    <td className="h-14 border-b border-border px-4 font-medium">{n}</td>
                    <td className="tabular border-b border-border px-4">{a}</td>
                    <td className="border-b border-border px-4">{c}</td>
                    <td className="border-b border-border px-4">
                      <StatusBadge status={st as 'active'} hideActive={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Demo>
        <Card>
          <EmptyState
            icon={<Inbox />}
            title="מצב ריק"
            description="מסביר למה האזור ריק ומה הצעד הבא — עם פעולה ברורה אחת."
            action={
              <Button variant="primary">
                <Plus />
                הוספה
              </Button>
            }
            headingLevel={3}
          />
        </Card>
      </Section>

      <Section id="overlays" title="חלוניות ותפריטים">
        <Demo title="Dialog · Alert Dialog · Drawer · Popover · Dropdown · Toast">
          <Row>
            <Button onClick={() => setDialog(true)}>חלון</Button>
            <Button onClick={() => setConfirm(true)}>אישור מחיקה</Button>
            <Button onClick={() => setSheet(true)}>מגירה</Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button>Popover</Button>
              </PopoverTrigger>
              <PopoverContent>
                <p className="text-body text-foreground">תוכן קצר בחלונית צפה.</p>
              </PopoverContent>
            </Popover>
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="פעולות נוספות">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <Pencil />
                  עריכה
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Mail />
                  שליחה במייל
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive>
                  <Trash2 />
                  מחיקה
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" onClick={() => toast.success('נשמר בהצלחה')}>
              Toast הצלחה
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.error('השמירה נכשלה', { description: 'נסו שוב בעוד רגע' })}
            >
              Toast שגיאה
            </Button>
          </Row>
        </Demo>
        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>כותרת חלון</DialogTitle>
              <DialogDescription>תיאור קצר של מטרת החלון.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field label="שדה לדוגמה">{(id, aria) => <Input id={id} {...aria} />}</Field>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => setDialog(false)}>ביטול</Button>
              <Button variant="primary" onClick={() => setDialog(false)}>
                שמירה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="למחוק את הפריט?"
          description="פעולות הרסניות תמיד מבקשות אישור."
          confirmLabel="מחיקה"
          destructive
          onConfirm={() => setConfirm(false)}
        />
        <Sheet open={sheet} onOpenChange={setSheet}>
          <SheetContent className="max-w-md p-6">
            <SheetTitle className="text-h2">מגירה (Drawer)</SheetTitle>
            <SheetDescription className="mt-1 text-body text-muted-foreground">
              נפתחת מצד שמאל (סוף השורה ב-RTL) — לטפסים ארוכים.
            </SheetDescription>
          </SheetContent>
        </Sheet>
      </Section>

      <Section id="feedback" title="משוב ומצבים">
        <div className="space-y-3">
          <Alert tone="success" title="נשמר בהצלחה">
            הפרטים עודכנו.
          </Alert>
          <Alert tone="destructive" title="השמירה נכשלה">
            בדקו את החיבור ונסו שוב.
          </Alert>
          <Alert tone="warning" title="שימו לב">
            חלק מהשדות לא מולאו.
          </Alert>
          <Alert tone="info">מידע כללי למשתמשת.</Alert>
          <Card className="flex items-center gap-3 p-4">
            <Spinner />
            <span className="text-body text-muted-foreground">טוען נתונים…</span>
          </Card>
        </div>
      </Section>
    </main>
  )
}
