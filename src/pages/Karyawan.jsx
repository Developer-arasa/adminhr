import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { formatTeksJam, normalizeStatus } from '../lib/utils';

const EMPTY = {
  id_karyawan: '',
  nama_karyawan: '',
  jabatan: '',
  departemen: '',
  nik_ktp: '',
  no_hp: '',
  tgl_gabung: '',
  jatah_cuti: 12,
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

function yearKey(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-');
  return parts[0] || null;
}

// Jumlah hari inklusif antara dua tanggal (YYYY-MM-DD)
function daySpan(start, end) {
  if (!start || !end) return 1;
  const a = new Date(start);
  const b = new Date(end);
  if (isNaN(a) || isNaN(b)) return 1;
  return Math.round((b - a) / 86400000) + 1;
}

// Ring (donat) progres SVG untuk visualisasi sisa cuti
function Ring({ value, max, size = 72, stroke = 9, color = 'var(--primary)', track = 'var(--bg-subtle)', showText = true }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const offset = c * (1 - pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
      />
      {showText && (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: size / 4, fontWeight: 700, fill: 'var(--text-main)' }}
        >
          {value}
        </text>
      )}
    </svg>
  );
}

export default function Karyawan() {
  const { master, izin, lembur, addKaryawan, updateKaryawan, deleteKaryawan, updateStatus, deleteRecord } = useAppStore();
  const notify = useToast();

  const [mainTab, setMainTab] = useState('induk');

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [openLembur, setOpenLembur] = useState(null);
  const [openRiwayat, setOpenRiwayat] = useState(null);

  const now = new Date();
  const thisYear = String(now.getFullYear());
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // state untuk management lembur
  const [lSearch, setLSearch] = useState('');
  const [lStatus, setLStatus] = useState('ALL');

  // state untuk management izin/cuti
  const [iSearch, setISearch] = useState('');
  const [iStatus, setIStatus] = useState('ALL');
  const [editJatah, setEditJatah] = useState(null); // { id, val }

  const filtered = master.filter((m) => {
    const q = search.toLowerCase();
    return (
      (m.nama_karyawan || '').toLowerCase().includes(q) ||
      (m.id_karyawan || '').toLowerCase().includes(q) ||
      (m.jabatan || '').toLowerCase().includes(q) ||
      (m.departemen || '').toLowerCase().includes(q)
    );
  });

  // Riwayat untuk karyawan yang dipilih (bulan ini saja)
  const riwayat = useMemo(() => {
    if (!selected) return { lemburBulanIni: [], izinBulanIni: [], totalJam: 0 };
    const id = selected.id_karyawan;
    const lemburBulanIni = lembur.filter((l) => l.id_karyawan === id && monthKey(l.tanggal_lembur) === thisMonth);
    const izinBulanIni = izin.filter((i) => i.id_karyawan === id && monthKey(i.tanggal_izin_mulai) === thisMonth);
    const totalJam = lemburBulanIni.reduce((s, l) => s + (parseFloat(l.durasi) || 0), 0);
    return { lemburBulanIni, izinBulanIni, totalJam };
  }, [selected, lembur, izin, thisMonth]);

  // --- Jatah cuti per karyawan ---
  const jatahRows = useMemo(() => {
    return master.map((m) => {
      const id = m.id_karyawan;
      const jatah = parseInt(m.jatah_cuti, 10) || 0;
      const approved = izin.filter(
        (i) => i.id_karyawan === id && yearKey(i.tanggal_izin_mulai) === thisYear && normalizeStatus(i.status) === 'APPROVED'
      );
      const terpakai = approved.reduce((s, i) => s + daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir), 0);
      return {
        id_karyawan: id,
        nama: m.nama_karyawan,
        jabatan: m.jabatan || '-',
        jatah,
        terpakai,
        sisa: jatah - terpakai,
      };
    });
  }, [master, izin, thisYear]);

  // --- Jatah cuti difilter berdasarkan pencarian ---
  const filteredJatah = useMemo(() => {
    const q = iSearch.toLowerCase();
    if (!q) return jatahRows;
    return jatahRows.filter(
      (r) => (r.nama || '').toLowerCase().includes(q) || (r.id_karyawan || '').toLowerCase().includes(q)
    );
  }, [jatahRows, iSearch]);

  // --- Agregat jatah cuti untuk analytics ---
  const cutiAgg = useMemo(() => {
    const jatah = jatahRows.reduce((s, r) => s + r.jatah, 0);
    const terpakai = jatahRows.reduce((s, r) => s + r.terpakai, 0);
    return { total: jatahRows.length, jatah, terpakai, sisa: jatah - terpakai };
  }, [jatahRows]);

  // --- Riwayat izin/cuti per karyawan (tidak difilter) untuk kartu jatah ---
  const izinByKaryawan = useMemo(() => {
    const map = new Map();
    for (const i of izin) {
      const key = i.id_karyawan || i.nama || '-';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(i);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => String(b.tanggal_izin_mulai || '').localeCompare(String(a.tanggal_izin_mulai || '')));
    }
    return map;
  }, [izin]);

  // --- Management Lembur: dikelompokkan per nama ---
  const groupedLembur = useMemo(() => {
    const q = lSearch.toLowerCase();
    const filtered = lembur.filter((l) => {
      const match =
        (l.nama || '').toLowerCase().includes(q) ||
        (l.id_karyawan || '').toLowerCase().includes(q);
      const statusOk = lStatus === 'ALL' || normalizeStatus(l.status) === lStatus;
      return match && statusOk;
    });

    const map = new Map();
    for (const l of filtered) {
      const key = l.id_karyawan || l.nama || '-';
      if (!map.has(key)) {
        map.set(key, { key, id_karyawan: l.id_karyawan, nama: l.nama || '-', items: [] });
      }
      map.get(key).items.push(l);
    }
    const groups = Array.from(map.values());
    for (const g of groups) {
      g.items.sort((a, b) => String(b.tanggal_lembur || '').localeCompare(String(a.tanggal_lembur || '')));
    }
    groups.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return groups;
  }, [lembur, lSearch, lStatus]);

  const lemburAgg = useMemo(() => {
    const totalJam = lembur.reduce((s, l) => s + (parseFloat(l.durasi) || 0), 0);
    const pending = lembur.filter((l) => normalizeStatus(l.status) === 'PENDING').length;
    const approved = lembur.filter((l) => normalizeStatus(l.status) === 'APPROVED').length;
    return { total: lembur.length, totalJam, pending, approved };
  }, [lembur]);

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
      jatah_cuti: m.jatah_cuti ?? 12,
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
        jatah_cuti: parseInt(form.jatah_cuti, 10) || 0,
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
  };

  const handleUpdateStatus = async (table, id, status) => {
    try {
      await updateStatus(table, id, status);
      notify('Status diperbarui.');
    } catch (e) {
      notify('Gagal memperbarui status.');
    }
  };

  const handleDeleteRecord = async (table, id) => {
    try {
      await deleteRecord(table, id);
      notify('Data berhasil dihapus.');
    } catch (e) {
      notify('Gagal menghapus data.');
    }
  };

  const saveJatah = async (row) => {
    try {
      await updateKaryawan(row.id_karyawan, { id_karyawan: row.id_karyawan, jatah_cuti: parseInt(editJatah.val, 10) || 0 });
      notify('Jatah cuti tersimpan!');
      setEditJatah(null);
    } catch (e) {
      notify('Gagal menyimpan jatah cuti.');
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="page-title">Karyawan</h2>
          <p className="page-sub">Kelola data karyawan Arasa.</p>
        </div>
        {mainTab === 'induk' && (
          <button className="btn btn-primary" onClick={openAdd}>
            + Tambah
          </button>
        )}
      </div>

      <div className="segmented main-tabs" style={{ marginBottom: 16 }}>
        <button className={`btn ${mainTab === 'induk' ? 'active' : ''}`} onClick={() => setMainTab('induk')}>
          Buku Induk
        </button>
        <button className={`btn ${mainTab === 'lembur' ? 'active' : ''}`} onClick={() => setMainTab('lembur')}>
          Management Lembur
        </button>
        <button className={`btn ${mainTab === 'izin' ? 'active' : ''}`} onClick={() => setMainTab('izin')}>
          Management Izin/Cuti
        </button>
      </div>

      {mainTab === 'induk' && (
        <>
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
        </>
      )}

      {mainTab === 'lembur' && (
        <>
          <div className="panel">
            <h3 className="detail-section" style={{ marginTop: 0 }}>Ringkasan Lembur</h3>
            <div className="cuti-analytics-metrics" style={{ minWidth: 0 }}>
              <div className="metric-card">
                <div className="metric-num">{lemburAgg.total}</div>
                <div className="metric-cap">Total Pengajuan</div>
              </div>
              <div className="metric-card">
                <div className="metric-num" style={{ color: 'var(--info)' }}>{formatTeksJam(lemburAgg.totalJam)}</div>
                <div className="metric-cap">Total Durasi</div>
              </div>
              <div className="metric-card">
                <div className="metric-num" style={{ color: 'var(--warning)' }}>{lemburAgg.pending}</div>
                <div className="metric-cap">Menunggu</div>
              </div>
              <div className="metric-card">
                <div className="metric-num" style={{ color: 'var(--success)' }}>{lemburAgg.approved}</div>
                <div className="metric-cap">Disetujui</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3 className="detail-section" style={{ marginTop: 0 }}>Riwayat Lembur per Karyawan</h3>
            <div className="toolbar">
              <input
                type="text"
                placeholder="Cari nama / ID karyawan..."
                value={lSearch}
                onChange={(e) => setLSearch(e.target.value)}
              />
              <select value={lStatus} onChange={(e) => setLStatus(e.target.value)}>
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Menunggu</option>
                <option value="APPROVED">Disetujui</option>
                <option value="REJECTED">Ditolak</option>
              </select>
            </div>

            {groupedLembur.length === 0 ? (
              <div className="empty">Tidak ada data lembur.</div>
            ) : (
              <div className="izin-groups">
                {groupedLembur.map((g) => {
                  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
                  g.items.forEach((it) => {
                    const s = normalizeStatus(it.status);
                    if (counts[s] !== undefined) counts[s]++;
                  });
                  const total = g.items.reduce((s, l) => s + (parseFloat(l.durasi) || 0), 0);
                  const isOpen = openLembur === g.key;
                  return (
                    <div className="group-card" key={g.key}>
                      <button
                        className="group-head accordion-toggle"
                        onClick={() => setOpenLembur(isOpen ? null : g.key)}
                        style={{ width: '100%' }}
                      >
                        <div className="group-head-id">
                          <span className="avatar avatar-sm">{initials(g.nama)}</span>
                          <div className="group-id-text">
                            <div className="group-name">{g.nama}</div>
                            <div className="group-sub">
                              <span className="type-chip green">{counts.APPROVED} acc</span>
                              <span className="type-chip amber">{counts.PENDING} pending</span>
                              <span className="type-chip red">{counts.REJECTED} ditolak</span>
                            </div>
                          </div>
                        </div>
                        <div className="group-durasi">
                          <span className="group-durasi-val">{formatTeksJam(total)}</span>
                        </div>
                        <span className={`accordion-chevron${isOpen ? ' open' : ''}`}>▾</span>
                      </button>
                      {isOpen && (
                        <div className="riwayat-list">
                          {g.items.map((l) => (
                            <div className="riwayat-card" key={l.id}>
                              <div className="riwayat-top">
                                <span className="type-chip blue">{formatTeksJam(l.durasi)}</span>
                                <StatusBadge status={l.status} />
                              </div>
                              <div className="riwayat-date">
                                {l.tanggal_lembur} · {l.jam_awal || '-'} - {l.jam_selesai || '-'}
                              </div>
                              {l.alasan && <div className="riwayat-alasan">{l.alasan}</div>}
                              <div className="riwayat-actions">
                                {normalizeStatus(l.status) === 'PENDING' && (
                                  <>
                                    <button className="btn btn-primary btn-sm" onClick={() => handleUpdateStatus('data_lembur', l.id, 'DISETUJUI')}>
                                      Setujui
                                    </button>
                                    <button className="btn btn-reject btn-sm" onClick={() => handleUpdateStatus('data_lembur', l.id, 'DITOLAK')}>
                                      Tolak
                                    </button>
                                  </>
                                )}
                                <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteRecord('data_lembur', l.id)}>
                                  Hapus
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {mainTab === 'izin' && (
        <>
          <div className="panel">
            <div className="toolbar" style={{ marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Cari nama / ID karyawan..."
                value={iSearch}
                onChange={(e) => setISearch(e.target.value)}
              />
              <select value={iStatus} onChange={(e) => setIStatus(e.target.value)}>
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Menunggu</option>
                <option value="APPROVED">Disetujui</option>
                <option value="REJECTED">Ditolak</option>
              </select>
            </div>
            <h3 className="detail-section" style={{ marginTop: 0 }}>Analitik Cuti Tahunan ({thisYear})</h3>
            <div className="cuti-analytics">
              <div className="cuti-analytics-ring">
                <Ring value={cutiAgg.sisa} max={cutiAgg.jatah} size={150} stroke={16} color="var(--primary)" showText={false} />
                <div className="cuti-analytics-center">
                  <div className="cuti-analytics-num">{cutiAgg.sisa}</div>
                  <div className="cuti-analytics-cap">Sisa Hari</div>
                </div>
              </div>
              <div className="cuti-analytics-metrics">
                <div className="metric-card">
                  <div className="metric-num" style={{ color: 'var(--primary)' }}>{cutiAgg.jatah}</div>
                  <div className="metric-cap">Total Jatah</div>
                </div>
                <div className="metric-card">
                  <div className="metric-num" style={{ color: 'var(--info)' }}>{cutiAgg.terpakai}</div>
                  <div className="metric-cap">Terpakai</div>
                </div>
                <div className="metric-card">
                  <div className="metric-num" style={{ color: 'var(--success)' }}>{cutiAgg.sisa}</div>
                  <div className="metric-cap">Sisa</div>
                </div>
                <div className="metric-card">
                  <div className="metric-num">{cutiAgg.total}</div>
                  <div className="metric-cap">Karyawan</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3 className="detail-section" style={{ marginTop: 0 }}>Jatah Cuti per Karyawan</h3>
            {filteredJatah.length === 0 ? (
              <div className="empty">Belum ada karyawan.</div>
            ) : (
              <div className="jatah-grid">
                {filteredJatah.map((r) => {
                  const pct = r.jatah > 0 ? r.terpakai / r.jatah : 0;
                  const ringColor = r.sisa < 0 ? 'var(--danger)' : pct >= 0.8 ? 'var(--warning)' : 'var(--success)';
                  return (
                    <div className="jatah-card" key={r.id_karyawan}>
                      <div className="jatah-card-top">
                        <div className="jatah-card-id">
                          <span className="avatar avatar-sm">{initials(r.nama)}</span>
                          <div>
                            <div className="jatah-card-name">{r.nama}</div>
                            <div className="jatah-card-role">{r.jabatan || '-'}</div>
                          </div>
                        </div>
                        <Ring value={r.sisa} max={r.jatah} size={56} stroke={7} color={ringColor} />
                      </div>
                      <div className="jatah-card-stats">
                        <div className="jatah-stat">
                          <span className="jatah-stat-label">Jatah</span>
                          <span className="jatah-stat-val">{r.jatah}</span>
                        </div>
                        <div className="jatah-stat">
                          <span className="jatah-stat-label">Terpakai</span>
                          <span className="jatah-stat-val" style={{ color: 'var(--info)' }}>{r.terpakai}</span>
                        </div>
                        <div className="jatah-stat">
                          <span className="jatah-stat-label">Sisa</span>
                          <span className="jatah-stat-val" style={{ color: ringColor }}>{r.sisa}</span>
                        </div>
                      </div>
                      {editJatah && editJatah.id === r.id_karyawan ? (
                        <div className="jatah-edit">
                          <input
                            type="number"
                            min="0"
                            value={editJatah.val}
                            onChange={(e) => setEditJatah({ ...editJatah, val: e.target.value })}
                          />
                          <button className="btn btn-primary" onClick={() => saveJatah(r)}>Simpan</button>
                          <button className="btn btn-ghost" onClick={() => setEditJatah(null)}>Batal</button>
                        </div>
                      ) : (
                        <div className="jatah-actions">
                          <button className="btn btn-outline jatah-edit-btn" onClick={() => setEditJatah({ id: r.id_karyawan, val: r.jatah })}>
                            Atur Jatah
                          </button>
                          <button
                            className="btn btn-ghost jatah-edit-btn"
                            onClick={() => setOpenRiwayat(openRiwayat === r.id_karyawan ? null : r.id_karyawan)}
                          >
                            Riwayat Cuti
                          </button>
                        </div>
                      )}
                      {openRiwayat === r.id_karyawan && (
                        <div className="riwayat-list jatah-riwayat">
                          {(() => {
                            const items = (izinByKaryawan.get(r.id_karyawan) || []).filter(
                              (i) => iStatus === 'ALL' || normalizeStatus(i.status) === iStatus
                            );
                            if (items.length === 0) {
                              return <div className="empty" style={{ padding: 12 }}>Belum ada riwayat izin/cuti.</div>;
                            }
                            return items.map((i) => (
                              <div className="riwayat-card" key={i.id}>
                                <div className="riwayat-top">
                                  <span className="type-chip blue">{i.kategori_izin || '-'}</span>
                                  <StatusBadge status={i.status} />
                                </div>
                                <div className="riwayat-date">
                                  {i.tanggal_izin_mulai} s/d {i.tanggal_izin_akhir}
                                </div>
                                {i.alasan && <div className="riwayat-alasan">{i.alasan}</div>}
                                <div className="riwayat-actions">
                                  {normalizeStatus(i.status) === 'PENDING' && (
                                    <>
                                      <button className="btn btn-primary btn-sm" onClick={() => handleUpdateStatus('data_izin', i.id, 'IZIN_DIBERIKAN')}>
                                        Setujui
                                      </button>
                                      <button className="btn btn-reject btn-sm" onClick={() => handleUpdateStatus('data_izin', i.id, 'IZIN_TIDAK_DIBERIKAN')}>
                                        Tolak
                                      </button>
                                    </>
                                  )}
                                  <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteRecord('data_izin', i.id)}>
                                    Hapus
                                  </button>
                                </div>
                              </div>
                            ))
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
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

          <div className="detail-section">Data Pekerjaan</div>
          <DetailRow label="Jabatan" value={selected.jabatan} />
          <DetailRow label="Departemen" value={selected.departemen} />
          <DetailRow label="Tanggal Gabung" value={selected.tgl_gabung} />
          <DetailRow label="Jatah Cuti Tahunan" value={`${selected.jatah_cuti ?? 12} hari`} />

          <div className="detail-section">Biodata</div>
          <DetailRow label="NIK KTP" value={selected.nik_ktp} />
          <DetailRow label="No. HP" value={selected.no_hp} />
          <DetailRow label="Tempat Lahir" value={selected.tempat_lahir} />
          <DetailRow label="Tanggal Lahir" value={selected.tgl_lahir} />
          <DetailRow label="Status Nikah" value={selected.status_nikah} />
          <DetailRow label="Alamat" value={selected.alamat_domisili} />
          <DetailRow label="Kontak Darurat" value={selected.kontak_darurat} />

          <div className="detail-section">Lembur Bulan Ini</div>
          <div className="detail-stat">
            <div>
              <div className="detail-stat-val">{formatTeksJam(riwayat.totalJam)}</div>
              <div className="detail-stat-label">Total jam</div>
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

          <div className="detail-section">Izin / Cuti Bulan Ini</div>
          {riwayat.izinBulanIni.length === 0 ? (
            <div className="empty">Belum ada izin/cuti bulan ini.</div>
          ) : (
            <div className="riwayat-list">
              {riwayat.izinBulanIni.map((i) => (
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
          <div className="field">
            <label>Jatah Cuti Tahunan (hari)</label>
            <input
              type="number"
              min="0"
              value={form.jatah_cuti ?? 12}
              onChange={(e) => setField('jatah_cuti', e.target.value)}
              placeholder="12"
            />
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