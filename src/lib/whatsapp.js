// Helper kirim notifikasi WhatsApp via Fonnte.
// Docs: https://docs.fonnte.com/

const FONNTE_TOKEN = import.meta.env.VITE_FONNTE_TOKEN || '';

function normalizePhone(phone) {
  if (!phone) return '';
  let p = String(phone).replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  else if (p.startsWith('8')) p = '62' + p;
  return p;
}

// Kirim pesan ke satu nomor. Tidak throw bila gagal, agar approval tetap jalan.
export async function sendWhatsApp(phone, message) {
  const target = normalizePhone(phone);
  if (!target) return { ok: false, reason: 'no-phone' };
  if (!FONNTE_TOKEN) {
    console.warn('[Fonnte] VITE_FONNTE_TOKEN belum diisi. Lewati kirim WA.');
    return { ok: false, reason: 'no-token' };
  }

  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: FONNTE_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target, message }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.status === false) {
      console.warn('[Fonnte] Gagal kirim WA ke', target, data);
      return { ok: false, reason: 'api-error', data };
    }
    return { ok: true, data };
  } catch (err) {
    console.warn('[Fonnte] Error kirim WA:', err);
    return { ok: false, reason: 'network-error' };
  }
}
