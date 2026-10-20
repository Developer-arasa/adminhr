import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { formatTeksJam } from '../lib/utils';

const EMPTY = {
  id_karyawan: '',
  nama_karyawan: '',
  jabatan: '',
  departemen: '',
  nik_ktp: '',
  no_hp: '',
  tgl_gabung: '',
};

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  const a = parts[0]?.[0] || '?';
  const b = parts[1]?.[0] || '';
  return (a + b).toUpperCase();
}

const AVATAR_COLORS = ['blue', 'indigo', 'green', 'amber', 'rose', 'teal'];

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-val">{value || '-'}</span>
    </div>
  );
}

function monthKey(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-');
  if (parts.length < 2) return null;
  return `${parts[0]}-${parts[1]}`;
}

export default function Karyawan() {
  const { master, izin, lembur, addKaryawan, updateKaryawan, deleteKaryawan } = useAppStore();
  const notify = useToast();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState('lembur');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const filtered = master.filter((m) => {
    const q = search.toLowerCase();
    return (
      (m.nama_karyawan || '').toLowerCase().includes(q) ||
      (m.id_karyawan || '').toLowerCase().includes(q) ||
      (m.jabatan || '').toLowerCase().includes(q) ||
      (m.departemen || '').toLowerCase().includes(q)
    );
  });

  // Riwayat untuk karyawan yang dipilih
  const riwayat = useMemo(() => {
    if (!selected) return { lembur: [], izin: [], lemburBulanIni: [], totalJam: 0 };
    const id = selected.id_karyawan;
    const lemburList = lembur.filter((l) => l.id_karyawan === id);
    const izinList = izin.filter((i) => i.id_karyawan === id);
    const bulanIni = lemburList.filter((l) => monthKey(l.tanggal_lembur) === thisMonth);
    const totalJam = bulanIni.reduce((s, l) => s + (parseFloat(l.durasi) || 0), 0);
    return { lembur: lemburList, izin: izinList, lemburBulanIni: bulanIni, totalJam };
  }, [selected, lembur, izin, thisMonth]);

  const openAdd = () => {
    setForm(EMPTY);
    setModal({ mode: 'ADD', originalId: null });
  };

  const openEdit = (m) => {
    setForm({
      id_karyawan: m.id_karyawan,
      nama_karyawan: m.nama_karyawan,
      jabatan: m.jabatan || '',
      departemen: m.departemen || '',
      nik_ktp: m.nik_ktp || '',
      no_hp: m.no_hp || '',
      tgl_gabung: m.tgl_gabung || '',
    });
    setModal({ mode: 'EDIT', originalId: m.id_karyawan });
    setSelected(null);
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const id = (form.id_karyawan || '').trim();
    const nm = (form.nama_karyawan || '').trim();
    if (!id || !nm) return notify('ID dan Nama wajib diisi!');

    const idLow = id.toLowerCase();
    const nmLow = nm.toLowerCase();

    const isEditSelf = (m) => modal.mode === 'EDIT' && m.id_karyawan === modal.originalId;
    for (const m of master) {
      if (m.id_karyawan.toLowerCase() === idLow && !isEditSelf(m)) {
        return notify(`ID Karyawan #${id} sudah terdaftar!`);
      }
      if ((m.nama_karyawan || '').toLowerCase() === nmLow && !isEditSelf(m)) {
        return notify(`Nama "${nm}" sudah terdaftar!`);
      }
    }

    try {
      const payload = {
        id_karyawan: id,
        nama_karyawan: nm,
        jabatan: form.jabatan,
        departemen: form.departemen,
        nik_ktp: form.nik_ktp,
        no_hp: form.no_hp,
        tgl_gabung: form.tgl_gabung || null,
      };
      if (modal.mode === 'EDIT') {
        await updateKaryawan(modal.originalId, payload);
      } else {
        await addKaryawan(payload);
      }
      notify('Data Karyawan tersimpan!');
      setModal(null);
    } catch (e) {
      notify('Gagal menyimpan data karyawan.');
    }
  };

  const doDelete = async () => {
    try {
      await deleteKaryawan(confirmDelete);
      notify('Karyawan berhasil dihapus!');
    } catch (e) {
      notify('Gagal menghapus karyawan.');
    }
    setConfirmDelete(null);
    setSelected(null);
  };

  const select = (m) => {
    setSelected(m);
    setDetailTab('lembur');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="page-title">Karyawan</h2>
          <p className="page-sub">Kelola data karyawan Arasa.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + Tambah
        </button>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Cari nama / ID / jabatan / departemen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">Data karyawan tidak ditemukan.</div>
      ) : (
        <div className="karyawan-grid">
          {filtered.map((m, idx) => {
            const tone = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            return (
              <button className="karyawan-card" key={m.id_karyawan} onClick={() => select(m)}>
                <span className={`avatar ${tone} avatar-lg`}>{initials(m.nama_karyawan)}</span>
                <span className="kcard-info">
                  <span className="kcard-name">{m.nama_karyawan}</span>
                  <span className="kcard-id">#{m.id_karyawan}</span>
                </span>
                <span className="kcard-job">{m.jabatan || '—'}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <Modal title="Detail Karyawan" onClose={() => setSelected(null)}>
          <div className="detail-head">
            <span className={`avatar ${AVATAR_COLORS[master.findIndex((x) => x.id_karyawan === selected.id_karyawan) % AVATAR_COLORS.length]} avatar-lg`}>
              {initials(selected.nama_karyawan)}
            </span>
            <div>
              <div className="detail-name">{selected.nama_karyawan}</div>
              <div className="req-meta">{selected.jabatan || '-'} · #{selected.id_karyawan}</div>
            </div>
          </div>

          <div className="segmented detail-tabs">
            <button className={`btn ${detailTab === 'lembur' ? 'active' : ''}`} onClick={() => setDetailTab('lembur')}>
              Riwayat Lembur
            </button>
            <button className={`btn ${detailTab === 'izin' ? 'active' : ''}`} onClick={() => setDetailTab('izin')}>
              Riwayat Izin/Cuti
            </button>
            <button className={`btn ${detailTab === 'biodata' ? 'active' : ''}`} onClick={() => setDetailTab('biodata')}>
              Biodata
            </button>
          </div>

          {detailTab === 'lembur' && (
            <div>
              <div className="detail-stat">
                <div>
                  <div className="detail-stat-val">{formatTeksJam(riwayat.totalJam)}</div>
                  <div className="detail-stat-label">Total lembur bulan ini</div>
                </div>
                <div>
                  <div className="detail-stat-val">{riwayat.lemburBulanIni.length}</div>
                  <div className="detail-stat-label">Kali lembur</div>
                </div>
              </div>

              {riwayat.lemburBulanIni.length === 0 ? (
                <div className="empty">Belum ada lembur bulan ini.</div>
              ) : (
                <div className="lembur-chart">
                  {riwayat.lemburBulanIni.map((l) => {
                    const pct = riwayat.totalJam > 0 ? Math.round(((parseFloat(l.durasi) || 0) / riwayat.totalJam) * 100) : 0;
                    return (
                      <div className="chart-row" key={l.id}>
                        <span className="chart-label">{l.tanggal_lembur}</span>
                        <div className="chart-bar">
                          <div className="chart-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="chart-val">{formatTeksJam(l.durasi)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {detailTab === 'izin' && (
            <div>
              {riwayat.izin.length === 0 ? (
                <div className="empty">Belum ada riwayat izin/cuti.</div>
              ) : (
                <div className="riwayat-list">
                  {riwayat.izin.map((i) => (
                    <div className="riwayat-card" key={i.id}>
                      <div className="riwayat-top">
                        <span className="type-chip blue">{i.kategori_izin || '-'}</span>
                        <StatusBadge status={i.status} />
                      </div>
                      <div className="riwayat-date">
                        {i.tanggal_izin_mulai} s/d {i.tanggal_izin_akhir}
                      </div>
                      {i.alasan && <div className="riwayat-alasan">{i.alasan}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {detailTab === 'biodata' && (
            <div>
              <div className="detail-section">Data Pekerjaan</div>
              <DetailRow label="Jabatan" value={selected.jabatan} />
              <DetailRow label="Departemen" value={selected.departemen} />
              <DetailRow label="Tanggal Gabung" value={selected.tgl_gabung} />

              <div className="detail-section">Biodata</div>
              <DetailRow label="NIK KTP" value={selected.nik_ktp} />
              <DetailRow label="No. HP" value={selected.no_hp} />
              <DetailRow label="Tempat Lahir" value={selected.tempat_lahir} />
              <DetailRow label="Tanggal Lahir" value={selected.tgl_lahir} />
              <DetailRow label="Status Nikah" value={selected.status_nikah} />
              <DetailRow label="Alamat" value={selected.alamat_domisili} />
              <DetailRow label="Kontak Darurat" value={selected.kontak_darurat} />
            </div>
          )}

          <div className="detail-actions">
            <button className="btn btn-reject" onClick={() => setConfirmDelete(selected.id_karyawan)}>
              Hapus
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => openEdit(selected)}>
              Edit Data
            </button>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title={modal.mode === 'ADD' ? 'Tambah Karyawan' : 'Edit Karyawan'} onClose={() => setModal(null)}>
          <div className="field">
            <label>ID Karyawan</label>
            <input type="text" value={form.id_karyawan} onChange={(e) => setField('id_karyawan', e.target.value)} placeholder="ID Karyawan" />
          </div>
          <div className="field">
            <label>Nama Lengkap</label>
            <input type="text" value={form.nama_karyawan} onChange={(e) => setField('nama_karyawan', e.target.value)} placeholder="Nama Lengkap" />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Jabatan</label>
              <input type="text" value={form.jabatan} onChange={(e) => setField('jabatan', e.target.value)} placeholder="Jabatan" />
            </div>
            <div className="field">
              <label>Departemen</label>
              <input type="text" value={form.departemen} onChange={(e) => setField('departemen', e.target.value)} placeholder="Departemen" />
            </div>
          </div>
          <div className="field">
            <label>NIK KTP</label>
            <input type="text" value={form.nik_ktp} onChange={(e) => setField('nik_ktp', e.target.value)} placeholder="NIK KTP" />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>No. HP</label>
              <input type="text" value={form.no_hp} onChange={(e) => setField('no_hp', e.target.value)} placeholder="No. HP" />
            </div>
            <div className="field">
              <label>Tanggal Gabung</label>
              <input type="date" value={form.tgl_gabung} onChange={(e) => setField('tgl_gabung', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>
              Batal
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>
              Simpan
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Konfirmasi" onClose={() => setConfirmDelete(null)}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Yakin ingin menghapus permanen karyawan ID #{confirmDelete}?</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>
              Batal
            </button>
            <button className="btn btn-reject" style={{ flex: 1 }} onClick={doDelete}>
              Hapus
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}