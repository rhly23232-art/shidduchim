import { gregorianToHebrew } from './hebrewDate'

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60_000)
  if (min < 1) return 'עכשיו'
  if (min < 60) return `לפני ${min} דק׳`
  const h = Math.round(min / 60)
  if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`
  const d = Math.round(h / 24)
  if (d === 1) return 'אתמול'
  if (d < 30) return `לפני ${d} ימים`
  return new Date(iso).toLocaleDateString('he-IL')
}

/** "כ״ה בחשון תשפ״ז · 14:05" */
export function hebrewDateTime(iso: string): string {
  const d = new Date(iso)
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  return `${gregorianToHebrew(ymd) ?? d.toLocaleDateString('he-IL')} · ${time}`
}
