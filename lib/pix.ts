function field(id: string, value: string) {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`
}

function crc16(payload: string) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1
    crc &= 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function normalize(value: string, max: number) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, max)
}

export function createPixPayload({ key, amount, txid, merchantName = 'ESPETO LIVRE', merchantCity = 'SAO PAULO' }: { key: string; amount: number; txid: string; merchantName?: string; merchantCity?: string }) {
  const merchantAccount = field('00', 'BR.GOV.BCB.PIX') + field('01', key.trim())
  const additionalData = field('05', txid.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 25) || '***')
  const payload = field('00', '01') + field('26', merchantAccount) + field('52', '0000') + field('53', '986') + field('54', amount.toFixed(2)) + field('58', 'BR') + field('59', normalize(merchantName, 25) || 'ESPETO LIVRE') + field('60', normalize(merchantCity, 15) || 'SAO PAULO') + field('62', additionalData) + '6304'
  return `${payload}${crc16(payload)}`
}

export function pixQrUrl(payload: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=${encodeURIComponent(payload)}`
}
