// Skrip untuk MEMPERBAIKI data lembur & izin yang "yatim" (id_karyawan lama
// tidak ada lagi di master_data) dengan meng-update id_karyawan ke ID baru.
//
// Cara pakai:
//   node scripts/fix-orphaned.mjs            -> preview saja (tidak mengubah)
//   node scripts/fix-orphaned.mjs --apply    -> benar-benar update data
//
// Mapping ID lama -> ID baru didefinisikan di bawah (variabel MAPPING).
// Data dengan ID lama yang TIDAK ada di MAPPING akan dianggap "out" dan dilewati.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// ---- MAPPING ID LAMA -> ID BARU (sesuaikan bila perlu) ----
const MAPPING = {
  '04': '126095',      // Abubakhri -> M. Syamsul Rizal Bahri
  '05': '126092',      // Faizar -> Faizar Dwi Ervianto
  '03': '126090',      // Shinta -> Caryna Shinta Aryanty
  '02': '126091',      // Ahma/Rahmad Dwi Andika -> Rahmad Dwi Andika
  '222222': '126089',  // Anata andriani -> Anata andriani
};

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
  const master = await fetchAll('master_data', 'id_karyawan, nama_karyawan');
  const validIds = new Set(master.map((m) => m.id_karyawan));

  const izin = await fetchAll('data_izin', 'id, id_karyawan, nama');
  const lembur = await fetchAll('data_lembur', 'id, id_karyawan, nama');

  const orphanIzin = izin.filter((r) => !validIds.has(r.id_karyawan));
  const orphanLembur = lembur.filter((r) => !validIds.has(r.id_karyawan));

  // Pisahkan: yang ada di MAPPING (akan di-fix) vs yang out (dilewati).
  const toFixIzin = orphanIzin.filter((r) => MAPPING[r.id_karyawan]);
  const toFixLembur = orphanLembur.filter((r) => MAPPING[r.id_karyawan]);
  const skippedIzin = orphanIzin.filter((r) => !MAPPING[r.id_karyawan]);
  const skippedLembur = orphanLembur.filter((r) => !MAPPING[r.id_karyawan]);

  console.log('==========================================================');
  console.log(APPLY ? 'MODE: APPLY (benar-benar mengubah data)' : 'MODE: PREVIEW (tidak mengubah apa pun)');
  console.log('==========================================================\n');

  console.log(`Akan di-fix   : ${toFixIzin.length} izin + ${toFixLembur.length} lembur`);
  console.log(`Dilewati (out): ${skippedIzin.length} izin + ${skippedLembur.length} lembur`);
  console.log('');

  // Validasi: pastikan semua ID baru di MAPPING ada di master_data.
  for (const [oldId, newId] of Object.entries(MAPPING)) {
    if (!validIds.has(newId)) {
      console.error(`ERROR: ID baru "${newId}" (dari ID lama "${oldId}") TIDAK ada di master_data.`);
      process.exit(1);
    }
  }

  const plan = [
    ...toFixIzin.map((r) => ({ table: 'data_izin', id: r.id, old: r.id_karyawan, new: MAPPING[r.id_karyawan], nama: r.nama })),
    ...toFixLembur.map((r) => ({ table: 'data_lembur', id: r.id, old: r.id_karyawan, new: MAPPING[r.id_karyawan], nama: r.nama })),
  ];

  if (plan.length === 0) {
    console.log('Tidak ada data yang perlu di-fix.');
    return;
  }

  console.log('--- RENCANA UPDATE ---');
  const grouped = {};
  for (const p of plan) {
    const k = `${p.table}|${p.old}|${p.new}`;
    grouped[k] = (grouped[k] || 0) + 1;
  }
  for (const [k, n] of Object.entries(grouped)) {
    const [table, oldId, newId] = k.split('|');
    console.log(`  ${table}: "${oldId}" -> "${newId}" (${n} record)`);
  }
  console.log('');

  if (!APPLY) {
    console.log('Jalankan dengan --apply untuk menerapkan perubahan.');
    return;
  }

  // Terapkan update per ID lama -> baru (lebih efisien & aman via .eq().update()).
  for (const [oldId, newId] of Object.entries(MAPPING)) {
    const [rI, rL] = await Promise.all([
      supabase.from('data_izin').update({ id_karyawan: newId }).eq('id_karyawan', oldId),
      supabase.from('data_lembur').update({ id_karyawan: newId }).eq('id_karyawan', oldId),
    ]);
    if (rI.error) throw new Error(`data_izin (${oldId}): ${rI.error.message}`);
    if (rL.error) throw new Error(`data_lembur (${oldId}): ${rL.error.message}`);
    console.log(`OK: "${oldId}" -> "${newId}" (izin ${rI.count ?? 0}, lembur ${rL.count ?? 0})`);
  }

  console.log('\nSelesai. Data yatim yang aktif sudah disambungkan ke ID baru.');
}

main().catch((e) => {
  console.error('Gagal:', e.message);
  process.exit(1);
});
