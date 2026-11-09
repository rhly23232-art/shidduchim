/** The record changed since it was opened (another tab, device or session). Nothing was saved. */
export class ConflictError extends Error {
  readonly code = 'conflict'
  constructor() {
    super('הכרטיס עודכן בינתיים במקום אחר')
    this.name = 'ConflictError'
  }
}

export const isConflict = (e: unknown): e is ConflictError =>
  e instanceof ConflictError ||
  (typeof e === 'object' && !!e && (e as { code?: string }).code === 'conflict')
