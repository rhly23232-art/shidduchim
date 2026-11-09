import { Badge } from '@/components/ui/badge'
import { he } from '@/lib/strings.he'
import type { CandidateStatus } from '@/lib/types'

const TONE = {
  active: 'success',
  in_process: 'warning',
  engaged: 'info',
  paused: 'neutral',
} as const

export function StatusBadge({
  status,
  hideActive = true,
}: {
  status: CandidateStatus
  hideActive?: boolean
}) {
  if (hideActive && status === 'active') return null
  return <Badge tone={TONE[status]}>{he.status[status]}</Badge>
}
