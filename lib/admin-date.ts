export function getAdminDateRange(dateValue?: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateValue ?? '') ? dateValue! : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const start = new Date(`${date}T00:00:00-03:00`)
  const end = new Date(`${date}T23:59:59.999-03:00`)
  return { date, start: start.toISOString(), end: end.toISOString() }
}

export function formatAdminDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Sao_Paulo' }).format(new Date(`${date}T12:00:00-03:00`))
}
