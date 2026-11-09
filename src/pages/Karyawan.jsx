import { useMemo, useState } from 'react';
import {
  Users,
  Building2,
  Calendar,
  Clock,
  Search,
  Plus,
  Edit2,
  Trash2,
  Briefcase,
  UserCheck,
  ShieldAlert,
  ArrowUpDown,
  ExternalLink,
  CalendarDays,
  HeartHandshake,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import {
  formatTeksJam,
  normalizeStatus,
  daySpan,
  getHariPotongCuti,
  formatTanggal,
  formatRentangTanggal,
  formatRentangJam,
} from '../lib/utils';

const EMPTY = {
  id_karyawan: '',
  nama_karyawan: '',
  jabatan: '',
  departemen: '',
  nik_ktp: '',
  no_hp: '',
  tgl_gabung: '',
  tempat_lahir: '',
  tgl_lahir: '',
  status_nikah: 'Belum Menikah',
  alamat_domisili: '',
  kontak_darurat: '',
  jatah_cuti: 12,
};

const AVATAR_COLORS = [
  { bg: '#ede9fe', color: '#7c3aed' },
  { bg: '#e0f2fe', color: '#0284c7' },
  { bg: '#d1fae5', color: '#059669' },
  { bg: '#fef3c7', color: '#d97706' },
  { bg: '#ffe4e6', color: '#e11d48' },
  { bg: '#f3e8ff', color: '#9333ea' },
];

function initials(name) {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/);
  const a = parts[0]?.[0] || '?';
  const b = parts[1]?.[0] || '';
  return (a + b).toUpperCase();
}

function hitungMasaKerja(tglGabung) {
  if (!tglGabung) return '-';
  const start = new Date(tglGabung);
  if (isNaN(start.getTime())) return '-';
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years > 0 && months > 0) return `${years} Tahun ${months} Bulan`;
  if (years > 0) return `${years} Tahun`;
  if (months > 0) return `${months} Bulan`;
  return '< 1 Bulan';
}

export default function Karyawan() {
  const { master, izin, lembur, addKaryawan, updateKaryawan, deleteKaryawan } =
    useAppStore();
  const notify = useToast();

  // Search & Filters for Main Grid
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [sortBy, setSortBy] = useState('nama_asc'); // nama_asc | nama_desc | id_asc | gabung_desc

  // Modal Detail State
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState('biodata'); // 'biodata' | 'cuti' | 'lembur'

  // History Filter inside Detail Modal
  const [filterCutiTahun, setFilterCutiTahun] = useState('ALL');
  const [filterCutiKategori, setFilterCutiKategori] = useState('ALL');
  const [sortCuti, setSortCuti] = useState('desc');

  const [filterLemburBulan, setFilterLemburBulan] = useState('ALL');
  const [sortLembur, setSortLembur] = useState('desc');

  // Form Modal State (Add / Edit)
  const [modalForm, setModalForm] = useState(null); // { mode: 'ADD'|'EDIT', originalId }
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Departments List
  const departments = useMemo(() => {
    const list = master
      .map((m) => m.departemen)
      .filter((d) => d && d.trim() !== '');
    return Array.from(new Set(list)).sort();
  }, [master]);

  // Main Filtered & Sorted Employees
  const filteredKaryawan = useMemo(() => {
    const q = search.toLowerCase();
    let res = master.filter((m) => {
      const matchSearch =
        (m.nama_karyawan || '').toLowerCase().includes(q) ||
        (m.id_karyawan || '').toLowerCase().includes(q) ||
        (m.jabatan || '').toLowerCase().includes(q) ||
        (m.departemen || '').toLowerCase().includes(q) ||
        (m.no_hp || '').includes(q);

      const matchDept = selectedDept === 'ALL' || m.departemen === selectedDept;
      return matchSearch && matchDept;
    });

    res = [...res].sort((a, b) => {
      if (sortBy === 'nama_asc') {
        return (a.nama_karyawan || '').localeCompare(b.nama_karyawan || '');
      }
      if (sortBy === 'nama_desc') {
        return (b.nama_karyawan || '').localeCompare(a.nama_karyawan || '');
      }
      if (sortBy === 'id_asc') {
        return (a.id_karyawan || '').localeCompare(b.id_karyawan || '');
      }
      if (sortBy === 'gabung_desc') {
        return String(b.tgl_gabung || '').localeCompare(String(a.tgl_gabung || ''));
      }
      return 0;
    });

    return res;
  }, [master, search, selectedDept, sortBy]);

  // Overview Stats
  const statsOverview = useMemo(() => {
    const thisYear = new Date().getFullYear().toString();
    const thisMonth = `${thisYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const activeIzinNow = izin.filter((i) => {
      const isApproved = normalizeStatus(i.status) === 'APPROVED';
      const isThisMonth = (i.tanggal_izin_mulai || '').startsWith(thisMonth);
      return isApproved && isThisMonth;
    }).length;

    const totalJamLembur = lembur.reduce((acc, l) => {
      return acc + (parseFloat(l.durasi) || 0);
    }, 0);

    return {
      total: master.length,
      depts: departments.length,
      izinAktif: activeIzinNow,
      jamLembur: Math.round(totalJamLembur * 10) / 10,
    };
  }, [master, departments, izin, lembur]);

  // Selected Employee Details Data (Leave & Overtime)
  const employeeData = useMemo(() => {
    if (!selected) return null;
    const id = selected.id_karyawan;
    const thisYear = new Date().getFullYear().toString();

    // Jatah Cuti Info
    const totalJatah = parseInt(selected.jatah_cuti ?? 12, 10);
    const allIzin = izin.filter((i) => i.id_karyawan === id);
    const approvedThisYear = allIzin.filter(
      (i) =>
        normalizeStatus(i.status) === 'APPROVED' &&
        (i.tanggal_izin_mulai || '').startsWith(thisYear)
    );
    const cutiTerpakai = approvedThisYear.reduce(
      (acc, x) => acc + getHariPotongCuti(x),
      0
    );
    const sisaCuti = totalJatah - cutiTerpakai;

    // Filtered Izin List for Tab 2
    let listIzin = [...allIzin];
    if (filterCutiTahun !== 'ALL') {
      listIzin = listIzin.filter((x) =>
        (x.tanggal_izin_mulai || '').startsWith(filterCutiTahun)
      );
    }
    if (filterCutiKategori !== 'ALL') {
      listIzin = listIzin.filter(
        (x) => (x.kategori_izin || '').toLowerCase() === filterCutiKategori.toLowerCase()
      );
    }
    listIzin.sort((a, b) => {
      const cmp = String(b.tanggal_izin_mulai || '').localeCompare(
        String(a.tanggal_izin_mulai || '')
      );
      return sortCuti === 'desc' ? cmp : -cmp;
    });

    // Overtime Info for Tab 3
    const allLembur = lembur.filter((l) => l.id_karyawan === id);
    const totalJam = allLembur.reduce(
      (acc, l) => acc + (parseFloat(l.durasi) || 0),
      0
    );

    let listLembur = [...allLembur];
    if (filterLemburBulan !== 'ALL') {
      listLembur = listLembur.filter((x) =>
        (x.tanggal_lembur || '').startsWith(filterLemburBulan)
      );
    }
    listLembur.sort((a, b) => {
      const cmp = String(b.tanggal_lembur || '').localeCompare(
        String(a.tanggal_lembur || '')
      );
      return sortLembur === 'desc' ? cmp : -cmp;
    });

    return {
      totalJatah,
      cutiTerpakai,
      sisaCuti,
      allIzin,
      listIzin,
      allLembur,
      totalJam: Math.round(totalJam * 10) / 10,
      totalSesi: allLembur.length,
      listLembur,
    };
  }, [
    selected,
    izin,
    lembur,
    filterCutiTahun,
    filterCutiKategori,
    sortCuti,
    filterLemburBulan,
    sortLembur,
  ]);

  // Form Handlers
  const handleOpenAdd = () => {
    setForm(EMPTY);
    setModalForm({ mode: 'ADD', originalId: null });
  };

  const handleOpenEdit = (m) => {
    setForm({
      id_karyawan: m.id_karyawan,
      nama_karyawan: m.nama_karyawan,
      jabatan: m.jabatan || '',
      departemen: m.departemen || '',
      nik_ktp: m.nik_ktp || '',
      no_hp: m.no_hp || '',
      tgl_gabung: m.tgl_gabung || '',
      tempat_lahir: m.tempat_lahir || '',
      tgl_lahir: m.tgl_lahir || '',
      status_nikah: m.status_nikah || 'Belum Menikah',
      alamat_domisili: m.alamat_domisili || '',
      kontak_darurat: m.kontak_darurat || '',
      jatah_cuti: m.jatah_cuti ?? 12,
    });
    setSelected(null);
    setTimeout(() => {
      setModalForm({ mode: 'EDIT', originalId: m.id_karyawan });
    }, 50);
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    const id = (form.id_karyawan || '').trim();
    const nm = (form.nama_karyawan || '').trim();
    if (!id || !nm) return notify('ID dan Nama Karyawan wajib diisi!', 'error');

    // Duplicate check
    const isEditSelf = (m) =>
      modalForm.mode === 'EDIT' && m.id_karyawan === modalForm.originalId;

    for (const m of master) {
      if (m.id_karyawan.toLowerCase() === id.toLowerCase() && !isEditSelf(m)) {
        return notify(`ID Karyawan #${id} sudah terdaftar!`, 'error');
      }
    }

    try {
      const payload = {
        id_karyawan: id,
        nama_karyawan: nm,
        jabatan: form.jabatan || null,
        departemen: form.departemen || null,
        nik_ktp: form.nik_ktp || null,
        no_hp: form.no_hp || null,
        tgl_gabung: form.tgl_gabung || null,
        tempat_lahir: form.tempat_lahir || null,
        tgl_lahir: form.tgl_lahir || null,
        status_nikah: form.status_nikah || null,
        alamat_domisili: form.alamat_domisili || null,
        kontak_darurat: form.kontak_darurat || null,
        jatah_cuti: parseInt(form.jatah_cuti, 10) || 12,
      };

      if (modalForm.mode === 'EDIT') {
        await updateKaryawan(modalForm.originalId, payload);
        notify('Profil karyawan berhasil diperbarui!', 'success');
      } else {
        await addKaryawan(payload);
        notify('Karyawan baru berhasil ditambahkan!', 'success');
      }
      setModalForm(null);
    } catch (err) {
      console.error(err);
      notify('Gagal menyimpan data karyawan.', 'error');
    }
  };

  const handleDeleteKaryawan = async () => {
    if (!confirmDelete) return;
    try {
      await deleteKaryawan(confirmDelete.id_karyawan);
      notify(`Karyawan ${confirmDelete.nama_karyawan} berhasil dihapus.`, 'success');
      setConfirmDelete(null);
      setSelected(null);
    } catch (err) {
      console.error(err);
      notify('Gagal menghapus karyawan.', 'error');
    }
  };

  return (
    <div className="karyawan-container">
      {/* Page Title & Top CTA */}
      <div className="page-head">
        <div>
          <h2 className="page-title">Direktori Karyawan</h2>
          <p className="page-sub">
            Pusat data terstruktur, biodata lengkap, saldo cuti, dan riwayat aktivitas tim.
          </p>
        </div>

        <button
          type="button"
          className="dash-hero-btn-primary"
          style={{ background: 'var(--primary-gradient)', color: '#fff' }}
          onClick={handleOpenAdd}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Tambah Karyawan</span>
        </button>
      </div>

      {/* =========================================================
          1. Quick Overview Metrics Bar
          ========================================================= */}
      <section className="karyawan-metrics-grid">
        <div className="k-metric-card">
          <div className="k-metric-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}>
            <Users size={20} strokeWidth={2.2} />
          </div>
          <div>
            <div className="k-metric-val">{statsOverview.total}</div>
            <div className="k-metric-lbl">Total Karyawan</div>
          </div>
        </div>

        <div className="k-metric-card">
          <div className="k-metric-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <Building2 size={20} strokeWidth={2.2} />
          </div>
          <div>
            <div className="k-metric-val">{statsOverview.depts}</div>
            <div className="k-metric-lbl">Departemen / Divisi</div>
          </div>
        </div>

        <div className="k-metric-card">
          <div className="k-metric-icon" style={{ background: '#d1fae5', color: '#059669' }}>
            <Calendar size={20} strokeWidth={2.2} />
          </div>
          <div>
            <div className="k-metric-val">{statsOverview.izinAktif}</div>
            <div className="k-metric-lbl">Izin/Cuti Bulan Ini</div>
          </div>
        </div>

        <div className="k-metric-card">
          <div className="k-metric-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={20} strokeWidth={2.2} />
          </div>
          <div>
            <div className="k-metric-val">{statsOverview.jamLembur} Jam</div>
            <div className="k-metric-lbl">Akumulasi Lembur</div>
          </div>
        </div>
      </section>

      {/* =========================================================
          2. Search, Filter & Sort Toolbar
          ========================================================= */}
      <div className="karyawan-toolbar-wrap">
        <div className="karyawan-search-row">
          <div className="karyawan-search-box">
            <Search size={16} className="karyawan-search-icon" />
            <input
              type="text"
              className="karyawan-search-input"
              placeholder="Cari nama, ID, jabatan, atau nomor HP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="karyawan-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="nama_asc">Nama (A &ndash; Z)</option>
            <option value="nama_desc">Nama (Z &ndash; A)</option>
            <option value="id_asc">ID Karyawan</option>
            <option value="gabung_desc">Bergabung Terbaru</option>
          </select>
        </div>

        {/* Horizontal Department Chips */}
        <div className="dept-chips-scroll">
          <button
            type="button"
            className={`dept-chip-btn ${selectedDept === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedDept('ALL')}
          >
            Semua ({master.length})
          </button>
          {departments.map((d) => (
            <button
              key={d}
              type="button"
              className={`dept-chip-btn ${selectedDept === d ? 'active' : ''}`}
              onClick={() => setSelectedDept(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================
          3. Employee Cards Grid
          ========================================================= */}
      {filteredKaryawan.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-state-icon">
            <Users size={24} />
          </div>
          <h4 style={{ margin: 0, fontWeight: 700 }}>Karyawan Tidak Ditemukan</h4>
          <p className="empty-state-text">
            Tidak ada data karyawan yang cocok dengan kriteria pencarian Anda.
          </p>
        </div>
      ) : (
        <div className="karyawan-grid">
          {filteredKaryawan.map((m, idx) => {
            const avatarTone = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const jatah = parseInt(m.jatah_cuti ?? 12, 10);

            // Cuti terpakai tahun ini
            const thisYear = new Date().getFullYear().toString();
            const appIzin = izin.filter(
              (i) =>
                i.id_karyawan === m.id_karyawan &&
                normalizeStatus(i.status) === 'APPROVED' &&
                (i.tanggal_izin_mulai || '').startsWith(thisYear)
            );
            const terpakai = appIzin.reduce((s, i) => s + getHariPotongCuti(i), 0);
            const sisaCuti = jatah - terpakai;

            // Jam lembur total
            const lemburHours = lembur
              .filter((l) => l.id_karyawan === m.id_karyawan)
              .reduce((s, l) => s + (parseFloat(l.durasi) || 0), 0);

            return (
              <div
                key={m.id_karyawan}
                className="karyawan-card-modern"
                onClick={() => {
                  setSelected(m);
                  setDetailTab('biodata');
                }}
              >
                <div className="karyawan-card-top">
                  <div
                    className="karyawan-avatar-circle"
                    style={{ background: avatarTone.bg, color: avatarTone.color }}
                  >
                    {initials(m.nama_karyawan)}
                  </div>

                  <div className="karyawan-card-info">
                    <div className="karyawan-card-name">{m.nama_karyawan}</div>
                    <div className="karyawan-card-job">{m.jabatan || m.departemen || 'Karyawan'}</div>
                    <span className="karyawan-card-id">#{m.id_karyawan}</span>
                  </div>
                </div>

                <div className="karyawan-card-chips">
                  {m.departemen && (
                    <span className="k-chip k-chip-dept">
                      🏢 {m.departemen}
                    </span>
                  )}
                  <span className="k-chip k-chip-cuti">
                    🏖️ {sisaCuti} Hari Cuti
                  </span>
                  {lemburHours > 0 && (
                    <span className="k-chip k-chip-lembur">
                      ⏰ {Math.round(lemburHours * 10) / 10} Jam
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================
          4. STRUCTURED DETAIL MODAL (Biodata, Cuti, Lembur)
          ========================================================= */}
      {selected && employeeData && (
        <Modal
          title=""
          maxWidth="800px"
          className="emp-detail-modal-box"
          onClose={() => setSelected(null)}
        >
          <div className="emp-detail-box">
            {/* Modal Hero Banner */}
            <div className="emp-detail-hero">
              <div className="emp-detail-hero-left">
                <div className="emp-detail-avatar">
                  {initials(selected.nama_karyawan)}
                </div>
                <div className="emp-detail-hero-title">
                  <h3>{selected.nama_karyawan}</h3>
                  <div className="emp-detail-hero-meta">
                    <span className="karyawan-card-id">#{selected.id_karyawan}</span>
                    <span className="k-chip k-chip-dept">{selected.jabatan || 'Karyawan'}</span>
                    {selected.departemen && (
                      <span className="k-chip k-chip-dept">🏢 {selected.departemen}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="emp-detail-actions">
                <button
                  type="button"
                  className="announce-action-btn"
                  onClick={() => handleOpenEdit(selected)}
                >
                  <Edit2 size={13} />
                  <span>Edit Profil</span>
                </button>

                <button
                  type="button"
                  className="announce-action-btn delete"
                  onClick={() => setConfirmDelete(selected)}
                >
                  <Trash2 size={13} />
                  <span>Hapus</span>
                </button>
              </div>
            </div>

            {/* Structured Tab Navigation */}
            <div className="emp-detail-nav">
              <button
                type="button"
                className={`emp-detail-tab-btn ${detailTab === 'biodata' ? 'active' : ''}`}
                onClick={() => setDetailTab('biodata')}
              >
                <UserCheck size={14} />
                <span>Biodata &amp; Profil</span>
              </button>

              <button
                type="button"
                className={`emp-detail-tab-btn ${detailTab === 'cuti' ? 'active' : ''}`}
                onClick={() => setDetailTab('cuti')}
              >
                <CalendarDays size={14} />
                <span>Saldo &amp; Riwayat Cuti</span>
              </button>

              <button
                type="button"
                className={`emp-detail-tab-btn ${detailTab === 'lembur' ? 'active' : ''}`}
                onClick={() => setDetailTab('lembur')}
              >
                <Clock size={14} />
                <span>Riwayat Lembur</span>
              </button>
            </div>

            {/* =========================================================
                TAB 1: BIODATA & PROFIL
                ========================================================= */}
            {detailTab === 'biodata' && (
              <div className="emp-biodata-grid">
                {/* Data Kepegawaian */}
                <div className="emp-info-card">
                  <div className="emp-info-card-header">
                    <Briefcase size={16} />
                    <span>Data Kepegawaian</span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">ID Karyawan:</span>
                    <span className="emp-kv-val">#{selected.id_karyawan}</span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Jabatan:</span>
                    <span className="emp-kv-val">{selected.jabatan || '-'}</span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Departemen:</span>
                    <span className="emp-kv-val">{selected.departemen || '-'}</span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Tanggal Bergabung:</span>
                    <span className="emp-kv-val">{formatTanggal(selected.tgl_gabung, 'long')}</span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Masa Kerja:</span>
                    <span className="emp-kv-val">{hitungMasaKerja(selected.tgl_gabung)}</span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Jatah Cuti Tahunan:</span>
                    <span className="emp-kv-val">{selected.jatah_cuti ?? 12} Hari</span>
                  </div>
                </div>

                {/* Data Personal & Kontak */}
                <div className="emp-info-card">
                  <div className="emp-info-card-header">
                    <HeartHandshake size={16} />
                    <span>Data Personal &amp; Kontak</span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">NIK KTP:</span>
                    <span className="emp-kv-val">{selected.nik_ktp || '-'}</span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Nomor HP:</span>
                    <span className="emp-kv-val">
                      {selected.no_hp ? (
                        <a
                          href={`https://wa.me/${selected.no_hp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          {selected.no_hp} <ExternalLink size={12} />
                        </a>
                      ) : (
                        '-'
                      )}
                    </span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Tempat, Tgl Lahir:</span>
                    <span className="emp-kv-val">
                      {selected.tempat_lahir || '-'}, {formatTanggal(selected.tgl_lahir, 'long')}
                    </span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Status Pernikahan:</span>
                    <span className="emp-kv-val">{selected.status_nikah || 'Belum Menikah'}</span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Kontak Darurat:</span>
                    <span className="emp-kv-val">{selected.kontak_darurat || '-'}</span>
                  </div>

                  <div className="emp-kv-row">
                    <span className="emp-kv-label">Alamat Domisili:</span>
                    <span className="emp-kv-val">{selected.alamat_domisili || '-'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 2: IWAYAT CUTI
                ========================================================= */}
            {detailTab === 'cuti' && (
              <div>
                {/* 3 Pills Balance Card */}
                <div className="emp-cuti-summary">
                  <div className="emp-cuti-pill blue">
                    <span className="emp-cuti-val">{employeeData.totalJatah}</span>
                    <span className="emp-cuti-lbl">Jatah Cuti Tahunan</span>
                  </div>
                  <div className="emp-cuti-pill amber">
                    <span className="emp-cuti-val">{employeeData.cutiTerpakai}</span>
                    <span className="emp-cuti-lbl">Sudah Terpakai</span>
                  </div>
                  <div className="emp-cuti-pill emerald">
                    <span className="emp-cuti-val">{employeeData.sisaCuti}</span>
                    <span className="emp-cuti-lbl">Sisa Cuti Tersedia</span>
                  </div>
                </div>

                {/* Filter Bar */}
                <div className="history-filter-bar">
                  <div className="history-filter-group">
                    <select
                      className="karyawan-filter-select"
                      value={filterCutiTahun}
                      onChange={(e) => setFilterCutiTahun(e.target.value)}
                    >
                      <option value="ALL">Semua Tahun</option>
                      <option value="2026">Tahun 2026</option>
                      <option value="2025">Tahun 2025</option>
                    </select>

                    <select
                      className="karyawan-filter-select"
                      value={filterCutiKategori}
                      onChange={(e) => setFilterCutiKategori(e.target.value)}
                    >
                      <option value="ALL">Semua Kategori</option>
                      <option value="Izin">Izin</option>
                      <option value="Sakit">Sakit</option>
                      <option value="Cuti">Cuti</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="announce-action-btn"
                    onClick={() => setSortCuti((v) => (v === 'desc' ? 'asc' : 'desc'))}
                  >
                    <ArrowUpDown size={12} />
                    <span>{sortCuti === 'desc' ? 'Terbaru' : 'Terlama'}</span>
                  </button>
                </div>

                {/* History List */}
                {employeeData.listIzin.length === 0 ? (
                  <div className="empty-state-modern" style={{ padding: '24px 14px' }}>
                    <p className="empty-state-text">Belum ada catatan izin atau cuti.</p>
                  </div>
                ) : (
                  <div className="emp-history-feed">
                    {employeeData.listIzin.map((i) => {
                      const durasi = daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir);
                      const potongHari = getHariPotongCuti(i);

                      return (
                        <div key={i.id} className="emp-history-card">
                          <div className="emp-history-top">
                            <div className="emp-history-badges">
                              <span className="type-chip blue">{i.kategori_izin || 'Izin'}</span>
                              <StatusBadge status={i.status} />
                              {normalizeStatus(i.status) === 'APPROVED' && (
                                <span
                                  className={`emp-tag-potong ${
                                    potongHari > 0 ? 'potong' : 'bebas'
                                  }`}
                                >
                                  {potongHari > 0
                                    ? `✂️ Potong ${potongHari} Hari`
                                    : '🛡️ Tanpa Potong Cuti'}
                                </span>
                              )}
                            </div>

                            <span className="emp-history-sub">{durasi} Hari</span>
                          </div>

                          <div className="emp-history-date">
                            {formatRentangTanggal(i.tanggal_izin_mulai, i.tanggal_izin_akhir, 'long')}
                          </div>

                          {i.alasan && (
                            <div className="emp-history-alasan">
                              &ldquo;{i.alasan}&rdquo;
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* =========================================================
                TAB 3: RIWAYAT LEMBUR
                ========================================================= */}
            {detailTab === 'lembur' && (
              <div>
                {/* 2 Pills Summary Card */}
                <div className="emp-lembur-summary">
                  <div className="emp-lembur-pill purple">
                    <div className="stat-icon-wrapper" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                      <Clock size={20} />
                    </div>
                    <div>
                      <div className="emp-cuti-val">{employeeData.totalJam} Jam</div>
                      <div className="emp-cuti-lbl">Total Durasi Lembur</div>
                    </div>
                  </div>

                  <div className="emp-lembur-pill blue">
                    <div className="stat-icon-wrapper" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                      <CalendarDays size={20} />
                    </div>
                    <div>
                      <div className="emp-cuti-val">{employeeData.totalSesi} Sesi</div>
                      <div className="emp-cuti-lbl">Frekuensi Lembur</div>
                    </div>
                  </div>
                </div>

                {/* Filter Bar */}
                <div className="history-filter-bar">
                  <div className="history-filter-group">
                    <select
                      className="karyawan-filter-select"
                      value={filterLemburBulan}
                      onChange={(e) => setFilterLemburBulan(e.target.value)}
                    >
                      <option value="ALL">Semua Periode</option>
                      <option value="2026-11">November 2026</option>
                      <option value="2026-10">Oktober 2026</option>
                      <option value="2026-09">September 2026</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="announce-action-btn"
                    onClick={() => setSortLembur((v) => (v === 'desc' ? 'asc' : 'desc'))}
                  >
                    <ArrowUpDown size={12} />
                    <span>{sortLembur === 'desc' ? 'Terbaru' : 'Terlama'}</span>
                  </button>
                </div>

                {/* Lembur List */}
                {employeeData.listLembur.length === 0 ? (
                  <div className="empty-state-modern" style={{ padding: '24px 14px' }}>
                    <p className="empty-state-text">Belum ada catatan lembur pada periode ini.</p>
                  </div>
                ) : (
                  <div className="emp-history-feed">
                    {employeeData.listLembur.map((l) => (
                      <div key={l.id} className="emp-history-card">
                        <div className="emp-history-top">
                          <span className="emp-history-date">
                            {formatTanggal(l.tanggal_lembur, 'long')}
                          </span>
                          <StatusBadge status={l.status} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                          <span style={{ color: 'var(--text-muted)' }}>
                            ⏰ {formatRentangJam(l.jam_awal, l.jam_selesai)}
                          </span>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            ({formatTeksJam(l.durasi)})
                          </span>
                        </div>

                        {l.alasan && (
                          <div className="emp-history-alasan">
                            &ldquo;{l.alasan}&rdquo;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* =========================================================
          MODAL FORM: TAMBAH / EDIT KARYAWAN
          ========================================================= */}
      {modalForm && (
        <Modal
          title=""
          onClose={() => setModalForm(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'var(--primary-soft)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {modalForm.mode === 'ADD' ? <Plus size={22} /> : <Edit2 size={22} />}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  {modalForm.mode === 'ADD' ? 'Tambah Karyawan Baru' : 'Edit Profil Karyawan'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Lengkapi data kepegawaian dan biodata resmi karyawan.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>ID Karyawan *</label>
                  <input
                    type="text"
                    required
                    disabled={modalForm.mode === 'EDIT'}
                    value={form.id_karyawan}
                    onChange={(e) => setForm((f) => ({ ...f, id_karyawan: e.target.value }))}
                    placeholder="Contoh: 124062"
                  />
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label>Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={form.nama_karyawan}
                    onChange={(e) => setForm((f) => ({ ...f, nama_karyawan: e.target.value }))}
                    placeholder="Contoh: Budi Santoso"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Jabatan</label>
                  <input
                    type="text"
                    value={form.jabatan}
                    onChange={(e) => setForm((f) => ({ ...f, jabatan: e.target.value }))}
                    placeholder="Contoh: Staff HR / Programmer"
                  />
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label>Departemen</label>
                  <input
                    type="text"
                    value={form.departemen}
                    onChange={(e) => setForm((f) => ({ ...f, departemen: e.target.value }))}
                    placeholder="Contoh: HR / IT / Operasional"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>NIK KTP</label>
                  <input
                    type="text"
                    value={form.nik_ktp}
                    onChange={(e) => setForm((f) => ({ ...f, nik_ktp: e.target.value }))}
                    placeholder="Nomor 16 digit NIK"
                  />
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label>No. HP / WhatsApp</label>
                  <input
                    type="text"
                    value={form.no_hp}
                    onChange={(e) => setForm((f) => ({ ...f, no_hp: e.target.value }))}
                    placeholder="081234567890"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Tanggal Gabung</label>
                  <input
                    type="date"
                    value={form.tgl_gabung}
                    onChange={(e) => setForm((f) => ({ ...f, tgl_gabung: e.target.value }))}
                  />
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label>Jatah Cuti Tahunan (Hari)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.jatah_cuti}
                    onChange={(e) => setForm((f) => ({ ...f, jatah_cuti: e.target.value }))}
                    placeholder="12"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Tempat Lahir</label>
                  <input
                    type="text"
                    value={form.tempat_lahir}
                    onChange={(e) => setForm((f) => ({ ...f, tempat_lahir: e.target.value }))}
                    placeholder="Kota Lahir"
                  />
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label>Tanggal Lahir</label>
                  <input
                    type="date"
                    value={form.tgl_lahir}
                    onChange={(e) => setForm((f) => ({ ...f, tgl_lahir: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Status Pernikahan</label>
                  <select
                    value={form.status_nikah}
                    onChange={(e) => setForm((f) => ({ ...f, status_nikah: e.target.value }))}
                  >
                    <option value="Belum Menikah">Belum Menikah</option>
                    <option value="Menikah">Menikah</option>
                    <option value="Cerai Hidup">Cerai Hidup</option>
                    <option value="Cerai Mati">Cerai Mati</option>
                  </select>
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <label>Kontak Darurat</label>
                  <input
                    type="text"
                    value={form.kontak_darurat}
                    onChange={(e) => setForm((f) => ({ ...f, kontak_darurat: e.target.value }))}
                    placeholder="Nama & No. HP Keluarga"
                  />
                </div>
              </div>

              <div className="field" style={{ margin: 0 }}>
                <label>Alamat Domisili</label>
                <textarea
                  rows={2}
                  value={form.alamat_domisili}
                  onChange={(e) => setForm((f) => ({ ...f, alamat_domisili: e.target.value }))}
                  placeholder="Alamat lengkap tempat tinggal saat ini..."
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setModalForm(null)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  <span>Simpan Data</span>
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* =========================================================
          MODAL KONFIRMASI HAPUS KARYAWAN
          ========================================================= */}
      {confirmDelete && (
        <Modal title="" onClose={() => setConfirmDelete(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Hapus Karyawan {confirmDelete.nama_karyawan}?
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Karyawan dengan ID #{confirmDelete.id_karyawan} akan dihapus permanen dari sistem.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteKaryawan}
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
