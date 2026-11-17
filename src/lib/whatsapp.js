// Helper kirim notifikasi WhatsApp via Akasha WhatsApp Gateway (Self-Hosted).
// Endpoint: https://akasha.tail5ad5ce.ts.net/api/send

const GATEWAY_URL =
  import.meta.env.VITE_WA_GATEWAY_URL || 'https://akasha.tail5ad5ce.ts.net/api/send';
const GATEWAY_TOKEN =
  import.meta.env.VITE_WA_GATEWAY_TOKEN ||
  import.meta.env.VITE_FONNTE_TOKEN ||
  'device_Web_HR_71742ed9ba00720e';

function normalizePhone(phone) {
  if (!phone) return '';
  let p = String(phone).replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  else if (p.startsWith('8')) p = '62' + p;
  return p;
}

// Kirim pesan ke satu nomor via Akasha Gateway. Tidak throw bila gagal, agar approval tetap jalan.
export async function sendWhatsApp(phone, message) {
  const target = normalizePhone(phone);
  if (!target) return { ok: false, reason: 'no-phone' };
  if (!GATEWAY_TOKEN) {
    console.warn('[Akasha WA] Token gateway belum diisi. Lewati kirim WA.');
    return { ok: false, reason: 'no-token' };
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: GATEWAY_TOKEN.startsWith('Bearer ') ? GATEWAY_TOKEN : `Bearer ${GATEWAY_TOKEN}`,
    };

    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ target, message }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || data?.status === false || data?.success === false) {
      console.warn('[Akasha WA] Gagal kirim WA ke', target, data);
      return { ok: false, reason: 'api-error', data };
    }
    return { ok: true, data };
  } catch (err) {
    console.warn('[Akasha WA] Error kirim WA:', err);
    return { ok: false, reason: 'network-error' };
  }
}
