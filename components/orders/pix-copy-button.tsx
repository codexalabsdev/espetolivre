'use client'

import { useState } from 'react'

export function PixCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copyPix() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button type="button" onClick={copyPix} className="mt-3 w-full rounded-xl border border-[#e3d7cc] bg-[#fffdfb] px-3 py-3 text-left text-xs font-bold text-[#201a16] transition hover:border-[#e76f27]">
      <span className="block truncate">{value}</span>
      <span className="mt-2 block text-center text-[#e76f27]">{copied ? 'Código copiado' : 'Copiar código Pix'}</span>
    </button>
  )
}
