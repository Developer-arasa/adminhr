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
  // Buang spasi & underscore, uppercase → "IZIN DIBERIKAN" jadi "IZINDIBERIKAN"
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

export const MONTH_NAMES = MNAMES;
