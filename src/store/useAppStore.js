import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { normalizeStatus } from '../lib/utils';
import { sendWhatsApp } from '../lib/whatsapp';

export const useAppStore = create((set, get) => ({
  master: [],
  izin: [],
  lembur: [],
  pengumuman: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [resMaster, resIzin, resLembur, resPengumuman] = await Promise.all([
        supabase.from('master_data').select('*').order('nama_karyawan'),
        supabase.from('data_izin').select('*').order('created_at', { ascending: false }),
        supabase.from('data_lembur').select('*').order('tanggal_lembur', { ascending: false }),
        supabase.from('data_pengumuman').select('*').order('tanggal', { ascending: false }),
      ]);

      if (resMaster.error) throw resMaster.error;
      if (resIzin.error) throw resIzin.error;
      if (resLembur.error) throw resLembur.error;
      if (resPengumuman.error) throw resPengumuman.error;

      set({
        master: resMaster.data || [],
        izin: resIzin.data || [],
        lembur: resLembur.data || [],
        pengumuman: resPengumuman.data || [],
        loading: false,
      });
    } catch (err) {
      console.error(err);
      set({ loading: false, error: 'Gagal terhubung ke database Supabase.' });
    }
  },

  // --- CRUD Karyawan ---
  addKaryawan: async ({ id_karyawan, nama_karyawan, jabatan, departemen, nik_ktp, no_hp, tgl_gabung, jatah_cuti }) => {
    const { error } = await supabase
      .from('master_data')
      .insert({ id_karyawan, nama_karyawan, jabatan, departemen, nik_ktp, no_hp, tgl_gabung, jatah_cuti: jatah_cuti ?? 12 });
    if (error) throw error;
    await get().fetchAll();
  },

  updateKaryawan: async (originalId, payload) => {
    const { id_karyawan: newId, ...rest } = payload;
    const idChanged = originalId !== newId;

    // 1. Update baris master_data (tetap di baris yang sama, tidak delete+insert).
    const { error } = await supabase
      .from('master_data')
      .update({ id_karyawan: newId, ...rest })
      .eq('id_karyawan', originalId);
    if (error) throw error;

    // 2. Jika ID berubah, ikut perbarui referensi id_karyawan di tabel anak
    //    agar data lembur & izin tetap tersambung (tidak menjadi yatim).
    if (idChanged) {
      const [resIzin, resLembur] = await Promise.all([
        supabase.from('data_izin').update({ id_karyawan: newId }).eq('id_karyawan', originalId),
        supabase.from('data_lembur').update({ id_karyawan: newId }).eq('id_karyawan', originalId),
      ]);
      if (resIzin.error) throw resIzin.error;
      if (resLembur.error) throw resLembur.error;
    }

    await get().fetchAll();
  },

  deleteKaryawan: async (id_karyawan) => {
    const { error } = await supabase.from('master_data').delete().eq('id_karyawan', id_karyawan);
    if (error) throw error;
    await get().fetchAll();
  },

  // --- Approval ---
  updateStatus: async (table, id, status) => {
    const { error } = await supabase.from(table).update({ status }).eq('id', id);
    if (error) throw error;

    // Notifikasi WhatsApp khusus untuk izin/cuti.
    if (table === 'data_izin') {
      const rec = get().izin.find((i) => i.id === id);
      if (rec) {
        const karyawan = get().master.find((m) => m.id_karyawan === rec.id_karyawan);
        const nama = karyawan?.nama_karyawan || rec.nama || 'Karyawan';
        const phone = karyawan?.no_hp || '';
        const kategori = rec.kategori_izin || 'Izin';
        const tgl = `${rec.tanggal_izin_mulai || '-'} s/d ${rec.tanggal_izin_akhir || '-'}`;
        const keputusan =
          normalizeStatus(status) === 'APPROVED' ? 'DISETUJUI ✅' : 'DITOLAK ❌';
        const msg = `Halo ${nama},\n\nPengajuan izin/cuti kamu (${kategori}) tanggal ${tgl} telah ${keputusan}.\n\nTerima kasih.`;
        // Fire-and-forget: jangan blokir alur approval.
        sendWhatsApp(phone, msg);
      }
    }

    await get().fetchAll();
  },

  bulkApproveLembur: async () => {
    const ids = get()
      .lembur.filter((x) => normalizeStatus(x.status) === 'PENDING')
      .map((x) => x.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('data_lembur')
      .update({ status: 'DISETUJUI' })
      .in('id', ids);
    if (error) throw error;
    await get().fetchAll();
  },

  deleteRecord: async (table, id) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    await get().fetchAll();
  },

  // --- Pengumuman (Papan Informasi) ---
  addPengumuman: async ({ judul, isi_pesan, label_kategori, tanggal }) => {
    const { error } = await supabase.from('data_pengumuman').insert({
      judul,
      isi_pesan: isi_pesan ?? null,
      label_kategori: label_kategori ?? 'Info',
      tanggal: tanggal || null,
    });
    if (error) throw error;
    await get().fetchAll();
  },

  updatePengumuman: async (id, { judul, isi_pesan, label_kategori, tanggal }) => {
    const { error } = await supabase
      .from('data_pengumuman')
      .update({
        judul,
        isi_pesan: isi_pesan ?? null,
        label_kategori: label_kategori ?? 'Info',
        tanggal: tanggal || null,
      })
      .eq('id', id);
    if (error) throw error;
    await get().fetchAll();
  },

  deletePengumuman: async (id) => {
    const { error } = await supabase.from('data_pengumuman').delete().eq('id', id);
    if (error) throw error;
    await get().fetchAll();
  },
}));
