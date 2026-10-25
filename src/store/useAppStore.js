import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { normalizeStatus } from '../lib/utils';

export const useAppStore = create((set, get) => ({
  master: [],
  izin: [],
  lembur: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [resMaster, resIzin, resLembur] = await Promise.all([
        supabase.from('master_data').select('*').order('nama_karyawan'),
        supabase.from('data_izin').select('*').order('created_at', { ascending: false }),
        supabase.from('data_lembur').select('*').order('tanggal_lembur', { ascending: false }),
      ]);

      if (resMaster.error) throw resMaster.error;
      if (resIzin.error) throw resIzin.error;
      if (resLembur.error) throw resLembur.error;

      set({
        master: resMaster.data || [],
        izin: resIzin.data || [],
        lembur: resLembur.data || [],
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
    // Jika ID berubah: hapus baris lama, lalu insert baris baru.
    if (originalId !== payload.id_karyawan) {
      const { error: delErr } = await supabase
        .from('master_data')
        .delete()
        .eq('id_karyawan', originalId);
      if (delErr) throw delErr;

      const { error: insErr } = await supabase.from('master_data').insert(payload);
      if (insErr) throw insErr;
    } else {
      const { id_karyawan, ...rest } = payload;
      const { error } = await supabase
        .from('master_data')
        .update(rest)
        .eq('id_karyawan', originalId);
      if (error) throw error;
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
}));
