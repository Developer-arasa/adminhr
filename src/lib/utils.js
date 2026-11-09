const MNAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const MNAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agt',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const DAYS_INDO = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

export const MONTH_NAMES = MNAMES;
export const MONTH_NAMES_SHORT = MNAMES_SHORT;
export const DAYS_NAMES_INDO = DAYS_INDO;

/**
 * Format tanggal ke versi Indonesia:
 * - 'short': "10 Nov 2026" (default)
 * - 'long': "10 November 2026"
 * - 'full': "Selasa, 10 November 2026"
 * - 'day-short': "Selasa, 10 Nov 2026"
 */
export function formatTanggal(dateInput, mode = 'short') {
  if (!dateInput) return '-';
  const str = String(dateInput).trim();
  // Safe parsing of YYYY-MM-DD to avoid timezone shift
  const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return String(dateInput);
    const day = dt.getDate();
    const month = dt.getMonth();
    const year = dt.getFullYear();
    const dayOfWeek = DAYS_INDO[dt.getDay()];
    if (mode === 'long') return `${day} ${MNAMES[month]} ${year}`;
    if (mode === 'full') return `${dayOfWeek}, ${day} ${MNAMES[month]} ${year}`;
    if (mode === 'day-short') return `${dayOfWeek}, ${day} ${MNAMES_SHORT[month]} ${year}`;
    return `${day} ${MNAMES_SHORT[month]} ${year}`;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  if (month < 0 || month > 11) return str;

  const monthArr = mode === 'long' || mode === 'full' ? MNAMES : MNAMES_SHORT;

  if (mode === 'full' || mode === 'day-short') {
    const dt = new Date(year, month, day);
    const dayOfWeek = DAYS_INDO[dt.getDay()];
    return `${dayOfWeek}, ${day} ${monthArr[month]} ${year}`;
  }

  return `${day} ${monthArr[month]} ${year}`;
}

/**
 * Format rentang tanggal versi Indonesia:
 * - Same date: "10 Nov 2026"
 * - Same month: "10 - 14 Nov 2026"
 * - Different month: "28 Okt - 2 Nov 2026"
 * - Different year: "30 Des 2025 - 2 Jan 2026"
 */
export function formatRentangTanggal(start, end, mode = 'short') {
  if (!start && !end) return '-';
  if (!end || start === end) return formatTanggal(start, mode);
  if (!start) return formatTanggal(end, mode);

  const mStart = String(start).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const mEnd = String(end).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (!mStart || !mEnd) {
    return `${formatTanggal(start, mode)} - ${formatTanggal(end, mode)}`;
  }

  const y1 = parseInt(mStart[1], 10);
  const m1 = parseInt(mStart[2], 10) - 1;
  const d1 = parseInt(mStart[3], 10);

  const y2 = parseInt(mEnd[1], 10);
  const m2 = parseInt(mEnd[2], 10) - 1;
  const d2 = parseInt(mEnd[3], 10);

  const monthArr = mode === 'long' ? MNAMES : MNAMES_SHORT;

  if (y1 === y2 && m1 === m2) {
    if (d1 === d2) return `${d1} ${monthArr[m1]} ${y1}`;
    return `${d1} - ${d2} ${monthArr[m1]} ${y1}`;
  }

  if (y1 === y2) {
    return `${d1} ${monthArr[m1]} - ${d2} ${monthArr[m2]} ${y1}`;
  }

  return `${d1} ${monthArr[m1]} ${y1} - ${d2} ${monthArr[m2]} ${y2}`;
}

/**
 * Format jam versi Indonesia:
 * "17:00:00" -> "17.00 WIB" (atau "17.00")
 * withZone: true -> "17.00 WIB", false -> "17.00"
 */
export function formatJam(timeInput, withZone = true) {
  if (!timeInput) return '-';
  const str = String(timeInput).trim();
  const match = str.match(/^(\d{1,2})[:.](\d{2})/);
  if (!match) return str;
  const hh = match[1].padStart(2, '0');
  const mm = match[2];
  return withZone ? `${hh}.${mm} WIB` : `${hh}.${mm}`;
}

/**
 * Format rentang jam kerja/lembur versi Indonesia:
 * jamAwal = "17:00:00", jamSelesai = "21:30:00" -> "17.00 - 21.30 WIB"
 */
export function formatRentangJam(jamAwal, jamSelesai, withZone = true) {
  if (!jamAwal && !jamSelesai) return '-';
  if (!jamSelesai) return formatJam(jamAwal, withZone);
  if (!jamAwal) return formatJam(jamSelesai, withZone);
  const j1 = formatJam(jamAwal, false);
  const j2 = formatJam(jamSelesai, false);
  return withZone ? `${j1} - ${j2} WIB` : `${j1} - ${j2}`;
}

/**
 * Format timestamp lengkap ke versi Indonesia:
 * "2026-11-10T14:30:00" -> "10 Nov 2026, 14.30 WIB"
 */
export function formatDateTime(dateTimeInput) {
  if (!dateTimeInput) return '-';
  const dt = new Date(dateTimeInput);
  if (isNaN(dt.getTime())) return String(dateTimeInput);
  const dateFormatted = formatTanggal(dt, 'short');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${dateFormatted}, ${hh}.${mm} WIB`;
}

export function getMonthStringFromDate(dateStr) {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length < 2) return '-';
  const m = parseInt(parts[1], 10) - 1;
  if (isNaN(m) || m < 0 || m > 11) return '-';
  return `${MNAMES[m]} ${parts[0]}`;
}

export function formatTeksJam(val) {
  if (!val || val === 0) return '0 Menit';
  const totalMenit = Math.round(parseFloat(val) * 60);
  const j = Math.floor(totalMenit / 60);
  const m = totalMenit % 60;
  if (j > 0 && m > 0) return `${j} Jam ${m} Menit`;
  if (j > 0) return `${j} Jam`;
  return `${m} Menit`;
}

export function getNama(row, master) {
  if (row.nama && row.nama.trim() !== '') return row.nama;
  const m = master.find((x) => x.id_karyawan === row.id_karyawan);
  return m ? m.nama_karyawan : 'Tanpa Nama';
}

// Normalisasi status: terima semua varian (lembur & izin, spasi/underscore, besar/kecil).
// Kembalikan 'PENDING' | 'APPROVED' | 'REJECTED'.
export function normalizeStatus(status) {
  const s = String(status || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '');
  if (s === 'PENDING' || s === 'MENUNGGU' || s === '' || s === 'NULL') return 'PENDING';
  if (
    s === 'DISETUJUI' ||
    s === 'IZINDIBERIKAN' ||
    s === 'DIBERIKAN' ||
    s === 'APPROVED'
  ) {
    return 'APPROVED';
  }
  if (
    s === 'DITOLAK' ||
    s === 'IZINTIDAKDIBERIKAN' ||
    s === 'TIDAKDIBERIKAN' ||
    s === 'REJECTED'
  ) {
    return 'REJECTED';
  }
  return 'PENDING';
}

// Jumlah hari inklusif antara dua tanggal (YYYY-MM-DD)
export function daySpan(start, end) {
  if (!start && !end) return 1;
  const s = start || end;
  const e = end || start;
  const a = new Date(s);
  const b = new Date(e);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 1;
  const diffTime = Math.abs(b - a);
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// Mendapatkan jumlah hari yang dipotong dari cuti tahunan
export function getHariPotongCuti(izinRow) {
  if (!izinRow) return 0;
  const alasan = String(izinRow.alasan || '');
  
  // Tag eksplisit: [Potong Cuti: X Hari]
  const match = alasan.match(/\[Potong Cuti:\s*(\d+)\s*Hari\]/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // Tag eksplisit: [Tanpa Potong Cuti]
  if (alasan.includes('[Tanpa Potong Cuti]') || alasan.includes('[Potong Cuti: 0 Hari]')) {
    return 0;
  }
  
  // Default legacy: Jika data izin lama tanpa tag
  // Sakit -> default 0
  const kat = String(izinRow.kategori_izin || '').toLowerCase();
  if (kat === 'sakit') {
    return 0;
  }
  // Kategori Izin / Cuti -> default daySpan
  return daySpan(izinRow.tanggal_izin_mulai, izinRow.tanggal_izin_akhir);
}
