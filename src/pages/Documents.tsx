import { Download, FileText, Mail, PenLine } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { buildResumeDocx } from '@/features/documents/resumeTemplate'
import { SendBlankResumeDialog } from '@/features/documents/SendBlankResumeDialog'
import { saveDocx } from '@/features/documents/useDocActions'
import { he } from '@/lib/strings.he'

const t = he.documents

/** Ready-made documents. Each card: what it is + its actions. */
export default function DocumentsPage() {
  const [sendOpen, setSendOpen] = useState(false)
  return (
    <main id="main" className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-16 pt-6 md:px-8">
      <p className="text-body text-muted-foreground">{t.subtitle}</p>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <li>
          <Card className="flex h-full flex-col p-6">
            <div className="flex items-start gap-4">
              <span
                className="grid size-12 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"
                aria-hidden
              >
                <FileText className="size-6" />
              </span>
              <div className="min-w-0">
                <h2 className="text-h3 text-foreground">{t.resume.name}</h2>
                <p className="mt-1 text-body text-muted-foreground">{t.resume.description}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="primary" asChild>
                <Link to="/documents/resume">
                  <PenLine />
                  {t.resume.fill}
                </Link>
              </Button>
              <Button onClick={() => void saveDocx(t.resume.fileBlank, buildResumeDocx())}>
                <Download />
                {t.resume.downloadBlank}
              </Button>
              <Button onClick={() => setSendOpen(true)}>
                <Mail />
                {t.resume.sendBlank}
              </Button>
            </div>
          </Card>
        </li>
      </ul>
      <SendBlankResumeDialog open={sendOpen} onOpenChange={setSendOpen} />
    </main>
  )
}
