'use client'

export function DateFilter({ date }: { date: string }) {
  return <label className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#55483f] shadow-sm">Dia<input type="date" value={date} onChange={(event) => { window.location.href = `?date=${event.target.value}` }} className="rounded-lg border border-[#eadfd4] px-2 py-1 font-normal" /></label>
}
