// Skrip READ-ONLY untuk mendeteksi data lembur & izin yang "yatim"
// (id_karyawan tidak ditemukan lagi di master_data).
//
// Cara pakai:
//   node scripts/find-orphaned.mjs
//
// Skrip ini otomatis memuat VITE_SUPABASE_URL dan VITE_SUPABASE_KEY dari .env.local.
// Ia TIDAK mengubah data apa pun; hanya menampilkan daftar data yatim agar Anda
// bisa menentukan sendiri mapping ID lama -> ID baru.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local secara manual (Node tidak otomatis memuat file .env seperti Vite).
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
try {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {
  // .env.local tidak ada; lanjut ke env sistem bila tersedia.
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('ERROR: VITE_SUPABASE_URL / VITE_SUPABASE_KEY tidak ditemukan.');
  console.error('Pastikan sudah ada di .env.local (lihat .env.example).');
  process.exit(1);
}

const supabase = createClient(url, key);

async function fetchAll(table, select = '*') {
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function main() {
  const [master, izin, lembur] = await Promise.all([
    fetchAll('master_data', 'id_karyawan, nama_karyawan'),
    fetchAll('data_izin', 'id, id_karyawan, nama, created_at'),
    fetchAll('data_lembur', 'id, id_karyawan, nama, created_at'),
  ]);

  const validIds = new Set(master.map((m) => m.id_karyawan));

  const orphanIzin = izin.filter((r) => !validIds.has(r.id_karyawan));
  const orphanLembur = lembur.filter((r) => !validIds.has(r.id_karyawan));

  console.log('==========================================================');
  console.log(`Total master_data : ${master.length} karyawan`);
  console.log(`Data izin yatim   : ${orphanIzin.length}`);
  console.log(`Data lembur yatim : ${orphanLembur.length}`);
  console.log('==========================================================\n');

  if (orphanIzin.length === 0 && orphanLembur.length === 0) {
    console.log('Tidak ada data yatim. Semua data sudah terhubung dengan master_data.');
    return;
  }

  // Ringkasan ID unik yatim: id_karyawan -> nama -> jumlah record.
  const group = (rows) => {
    const g = {};
    for (const r of rows) {
      const k = r.id_karyawan;
      g[k] = g[k] || { nama: r.nama, n: 0 };
      g[k].n++;
    }
    return g;
  };

  const gi = group(orphanIzin);
  const gl = group(orphanLembur);

  console.log('--- ID KARYAWAN VALID DI master_data (untuk dicocokkan) ---');
  for (const m of master) {
    console.log(`  "${m.id_karyawan}" -> ${m.nama_karyawan}`);
  }
  console.log('');

  if (orphanIzin.length) {
    console.log('--- RINGKASAN IZIN YATIM (id lama -> nama -> jumlah) ---');
    for (const k of Object.keys(gi)) {
      console.log(`  "${k}" -> ${gi[k].nama} -> ${gi[k].n} record`);
    }
    console.log('');
  }

  if (orphanLembur.length) {
    console.log('--- RINGKASAN LEMBUR YATIM (id lama -> nama -> jumlah) ---');
    for (const k of Object.keys(gl)) {
      console.log(`  "${k}" -> ${gl[k].nama} -> ${gl[k].n} record`);
    }
    console.log('');
  }

  console.log('Catatan: tentukan sendiri mapping id_karyawan lama -> baru,');
  console.log('lalu perbaiki datanya (mis. lewat Supabase UI atau skrip update terpisah).');
}

main().catch((e) => {
  console.error('Gagal menjalankan skrip:', e.message);
  process.exit(1);
});
