'use client'

export function ReportActions({ date }: { date: string }) {
  return <div className="flex flex-wrap gap-2"><span className="w-full text-xs font-bold uppercase tracking-widest text-[#806b5b]">Exportar relatório</span>{['pdf', 'csv', 'xlsx', 'doc'].map((format) => <button key={format} type="button" onClick={() => { if (format === 'pdf') { window.open(`/api/admin/report?date=${date}&format=pdf`, '_blank'); return }; window.location.href = `/api/admin/report?date=${date}&format=${format}` }} className="rounded-lg border border-[#eadfd4] bg-white px-3 py-2 text-xs font-black uppercase text-[#55483f]">{format}</button>)}</div>
}
