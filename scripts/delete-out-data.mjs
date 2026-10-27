// Skrip untuk MENGHAPUS PERMANEN data lembur & izin milik karyawan yang
// sudah OUT (id_karyawan-nya tidak lagi ada di master_data).
//
// Cara pakai:
//   node scripts/delete-out-data.mjs            -> preview saja (tidak menghapus)
//   node scripts/delete-out-data.mjs --apply    -> benar-benar menghapus
//
// PERINGATAN: penghapusan bersifat permanen dan tidak bisa dibatalkan.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

// Load .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('ERROR: VITE_SUPABASE_URL / VITE_SUPABASE_KEY tidak ditemukan di .env.local.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function fetchAll(table, select = '*') {
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function main() {
  const master = await fetchAll('master_data', 'id_karyawan');
  const validIds = new Set(master.map((m) => m.id_karyawan));

  const izin = await fetchAll('data_izin', 'id, id_karyawan, nama');
  const lembur = await fetchAll('data_lembur', 'id, id_karyawan, nama');

  const orphanIzin = izin.filter((r) => !validIds.has(r.id_karyawan));
  const orphanLembur = lembur.filter((r) => !validIds.has(r.id_karyawan));

  console.log('==========================================================');
  console.log(APPLY ? 'MODE: APPLY (menghapus permanen)' : 'MODE: PREVIEW (tidak menghapus apa pun)');
  console.log('==========================================================\n');

  console.log(`Akan dihapus : ${orphanIzin.length} izin + ${orphanLembur.length} lembur`);
  console.log('');

  if (orphanIzin.length === 0 && orphanLembur.length === 0) {
    console.log('Tidak ada data yatim. Tidak ada yang perlu dihapus.');
    return;
  }

  // Ringkasan per id_karyawan
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

  console.log('--- RINGKASAN YANG AKAN DIHAPUS ---');
  for (const [id, v] of Object.entries(gi)) {
    console.log(`  izin   "${id}" -> ${v.nama} (${v.n} record)`);
  }
  for (const [id, v] of Object.entries(gl)) {
    console.log(`  lembur "${id}" -> ${v.nama} (${v.n} record)`);
  }
  console.log('');

  if (!APPLY) {
    console.log('Jalankan dengan --apply untuk menghapus permanen.');
    return;
  }

  // Hapus per id_karyawan yatim.
  const orphanIds = new Set([...orphanIzin.map((r) => r.id_karyawan), ...orphanLembur.map((r) => r.id_karyawan)]);

  for (const id of orphanIds) {
    const [rI, rL] = await Promise.all([
      supabase.from('data_izin').delete().eq('id_karyawan', id),
      supabase.from('data_lembur').delete().eq('id_karyawan', id),
    ]);
    if (rI.error) throw new Error(`data_izin ("${id}"): ${rI.error.message}`);
    if (rL.error) throw new Error(`data_lembur ("${id}"): ${rL.error.message}`);
    console.log(`HAPUS "${id}": selesai`);
  }

  console.log('\nSelesai. Semua data yatim milik karyawan OUT sudah dihapus permanen.');
}

main().catch((e) => {
  console.error('Gagal:', e.message);
  process.exit(1);
});
