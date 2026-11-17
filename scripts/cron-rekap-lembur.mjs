// Skrip Cron Job: Notifikasi Pengajuan Lembur Karyawan ke WhatsApp HRD via Akasha WhatsApp Gateway.
// Dijalankan otomatis setiap hari pukul 08:00 WIB via Linux crontab atau process manager (PM2).
// HANYA mengirim lembur yang berstatus PENGAJUAN (PENDING / belum disetujui HRD).
//
// Jadwal Cron Tab:
// 0 8 * * * cd /path/to/hrdashboard && node scripts/cron-rekap-lembur.mjs >> /var/log/cron-lembur.log 2>&1
//
// Testing manual:
//   node scripts/cron-rekap-lembur.mjs --dry-run
//   node scripts/cron-rekap-lembur.mjs --date 2026-11-15 --dry-run
//   node scripts/cron-rekap-lembur.mjs --all-pending --dry-run

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// --- 1. Load Konfigurasi Lingkungan (.env.local) ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');

try {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;
    const eqIdx = trimmedLine.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmedLine.slice(0, eqIdx).trim();
      const val = trimmedLine.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  }
} catch {
  // Lanjut menggunakan process.env dari sistem jika file .env.local tidak ada
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const gatewayUrl =
  process.env.VITE_WA_GATEWAY_URL ||
  process.env.AKASHA_WA_URL ||
  process.env.WA_GATEWAY_URL ||
  'https://akasha.tail5ad5ce.ts.net/api/send';
const gatewayToken =
  process.env.VITE_WA_GATEWAY_TOKEN ||
  process.env.AKASHA_WA_TOKEN ||
  process.env.WA_GATEWAY_TOKEN ||
  'device_Web_HR_71742ed9ba00720e';
const hrdPhone = process.env.WA_HRD_PHONE || process.env.HRD_PHONE || '';

// Parse argumen CLI
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isAllPending = args.includes('--all-pending');
let customDate = null;
const dateArgIdx = args.indexOf('--date');
if (dateArgIdx !== -1 && args[dateArgIdx + 1]) {
  customDate = args[dateArgIdx + 1];
}

// Normalisasi status pengajuan
function normalizeStatus(raw) {
  if (!raw) return 'PENDING';
  const s = String(raw).trim().toUpperCase();
  if (s === 'APPROVED' || s === 'DISETUJUI' || s === 'ACC') return 'APPROVED';
  if (s === 'REJECTED' || s === 'DITOLAK') return 'REJECTED';
  return 'PENDING';
}

// Format nomor HP ke standar internasional (62xxx)
function normalizePhone(phone) {
  if (!phone) return '';
  let p = String(phone).replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  else if (p.startsWith('8')) p = '62' + p;
  return p;
}

// Nama hari dan bulan dalam Bahasa Indonesia
const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_INDONESIA = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatTanggalIndo(dateStr) {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length < 3) return dateStr;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  const hari = HARI_INDONESIA[dt.getDay()] || '';
  const bulan = BULAN_INDONESIA[m - 1] || '';
  return `${hari ? hari + ', ' : ''}${d} ${bulan} ${y}`;
}

async function run() {
  console.log(`[${new Date().toISOString()}] Memeriksa pengajuan lembur masuk untuk WhatsApp HRD...`);

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Kredensial Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_KEY) tidak ditemukan.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Tentukan tanggal target rekapitulasi (default: Kemarin / H-1)
  let targetDate = customDate;
  if (!targetDate && !isAllPending) {
    // Hitung tanggal H-1 sesuai zona waktu WIB (UTC+7)
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const wibMs = utcMs + 7 * 3600000;
    const wibDate = new Date(wibMs);
    wibDate.setDate(wibDate.getDate() - 1); // Kemarin

    const y = wibDate.getFullYear();
    const m = String(wibDate.getMonth() + 1).padStart(2, '0');
    const d = String(wibDate.getDate()).padStart(2, '0');
    targetDate = `${y}-${m}-${d}`;
  }

  // 1. Ambil data lembur dari Supabase
  let query = supabase
    .from('data_lembur')
    .select('*')
    .order('tanggal_lembur', { ascending: false })
    .order('jam_awal', { ascending: true });

  if (targetDate && !isAllPending) {
    query = query.eq('tanggal_lembur', targetDate);
  }

  const { data: rawList, error: errLembur } = await query;

  if (errLembur) {
    console.error('ERROR: Gagal mengambil data lembur dari Supabase:', errLembur);
    process.exit(1);
  }

  // Filter EKSKLUSIF: HANYA YANG BERSTATUS PENGAJUAN (PENDING)!
  // Yang sudah APPROVED/DISETUJUI atau REJECTED/DITOLAK tidak dimasukkan!
  const pendingLembur = (rawList || []).filter((l) => normalizeStatus(l.status) === 'PENDING');

  // Hitung juga total pending keseluruhan di sistem (untuk informasi HRD)
  const { data: allPendingRaw } = await supabase
    .from('data_lembur')
    .select('id, status');
  const totalAllPending = (allPendingRaw || []).filter((l) => normalizeStatus(l.status) === 'PENDING').length;

  // 2. Ambil master data karyawan untuk melengkapi data divisi & jabatan
  const { data: masterList } = await supabase
    .from('master_data')
    .select('id_karyawan, nama_karyawan, departemen, jabatan');

  const masterMap = new Map();
  if (masterList) {
    for (const m of masterList) {
      masterMap.set(m.id_karyawan, m);
    }
  }

  // 3. Susun Pesan WhatsApp Khusus Pengajuan
  let message = '';

  if (pendingLembur.length === 0) {
    const tglLabel = targetDate ? ` pada ${formatTanggalIndo(targetDate)}` : '';
    message =
      `*PENGAJUAN LEMBUR KARYAWAN*\n` +
      `Waktu Lapor: 08:00 WIB\n\n` +
      `Tidak ada pengajuan lembur baru yang masuk${tglLabel}.\n`;

    if (totalAllPending > 0) {
      message += `\n_Catatan: Masih terdapat ${totalAllPending} pengajuan lembur sebelumnya yang menunggu persetujuan di dashboard._\n`;
    }

    message += `\n_Pesan otomatis dari Sistem Informasi SDM_`;
  } else {
    let totalJamPengajuan = 0;
    pendingLembur.forEach((l) => {
      totalJamPengajuan += parseFloat(l.durasi) || 0;
    });
    totalJamPengajuan = Math.round(totalJamPengajuan * 10) / 10;
    const uniqueEmployees = new Set(pendingLembur.map((l) => l.id_karyawan || l.nama)).size;
    const tglJudul = targetDate ? formatTanggalIndo(targetDate) : 'Menunggu Persetujuan';

    message =
      `*PENGAJUAN LEMBUR KARYAWAN*\n` +
      `Periode: ${tglJudul}\n` +
      `Waktu Lapor: 08:00 WIB\n\n` +
      `*RINGKASAN PENGAJUAN:*\n` +
      `• Total Pengajuan: ${pendingLembur.length} sesi lembur\n` +
      `• Jumlah Karyawan: ${uniqueEmployees} orang\n` +
      `• Akumulasi Durasi: ${totalJamPengajuan} jam\n` +
      `• Status: Menunggu Persetujuan HRD\n\n` +
      `*DAFTAR PENGAJUAN LEMBUR:*\n`;

    // Tampilkan rincian (maksimal 20 agar pesan tidak terpotong WhatsApp)
    const displayList = pendingLembur.slice(0, 20);

    displayList.forEach((l, idx) => {
      const emp = masterMap.get(l.id_karyawan);
      const nama = l.nama || emp?.nama_karyawan || 'Karyawan';
      const divisi = emp?.departemen || 'Umum';
      const jamAwal = l.jam_awal ? String(l.jam_awal).slice(0, 5) : '-';
      const jamSelesai = l.jam_selesai ? String(l.jam_selesai).slice(0, 5) : '-';
      const durasi = parseFloat(l.durasi) || 0;
      const alasan = (l.alasan || '-').trim();
      const tglItem = !targetDate ? `\n   • Tanggal: ${formatTanggalIndo(l.tanggal_lembur)}` : '';

      message +=
        `${idx + 1}. *${nama}* (${divisi})${tglItem}\n` +
        `   • Waktu: ${jamAwal} - ${jamSelesai} (${durasi} Jam)\n` +
        `   • Pekerjaan: ${alasan}\n\n`;
    });

    if (pendingLembur.length > 20) {
      message += `_... dan ${pendingLembur.length - 20} pengajuan lainnya._\n\n`;
    }

    message +=
      `Silakan buka menu Persetujuan di HR Dashboard untuk memproses pengajuan lembur di atas.\n\n` +
      `_Pesan otomatis dari Sistem Informasi SDM_`;
  }

  console.log('\n--- PREVIEW PESAN WHATSAPP (HANYA PENGAJUAN) ---');
  console.log(message);
  console.log('-------------------------------------------------\n');

  if (isDryRun) {
    console.log('[DRY-RUN] Mode simulasi aktif. Pesan tidak dikirim ke gateway.');
    return;
  }

  // 4. Kirim ke Akasha WhatsApp Gateway
  const targetPhone = normalizePhone(hrdPhone);
  if (!targetPhone) {
    console.warn('PERINGATAN: WA_HRD_PHONE belum disetel di .env.local. Pengiriman dibatalkan.');
    console.warn('Setel variabel: WA_HRD_PHONE=628xxxxxxxxxx');
    return;
  }

  console.log(`Mengirim notifikasi pengajuan lembur ke HRD (${targetPhone}) via Akasha Gateway: ${gatewayUrl}`);

  try {
    const payload = {
      to: targetPhone,
      target: targetPhone,
      phone: targetPhone,
      number: targetPhone,
      message: message,
      text: message,
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    if (gatewayToken) {
      headers['Authorization'] = gatewayToken.startsWith('Bearer ') ? gatewayToken : `Bearer ${gatewayToken}`;
      headers['x-api-key'] = gatewayToken;
      headers['apikey'] = gatewayToken;
    }

    const res = await fetch(gatewayUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const resBody = await res.text();
    let resData;
    try {
      resData = JSON.parse(resBody);
    } catch {
      resData = resBody;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${typeof resData === 'object' ? JSON.stringify(resData) : resData}`);
    }

    console.log('SUKSES: Notifikasi pengajuan lembur berhasil dikirim ke WhatsApp HRD.');
    console.log('Respon Gateway:', resData);
  } catch (sendErr) {
    console.error('ERROR: Gagal mengirim pesan via Akasha WhatsApp Gateway:', sendErr.message);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
