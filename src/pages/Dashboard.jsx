import { useMemo, useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Users,
  Clock,
  Flame,
  TrendingUp,
  Sparkles,
  Plus,
  ArrowRight,
  Calendar,
  CheckCircle2,
  FileText,
  Megaphone,
  Edit2,
  Trash2,
  X,
  Send,
  Award,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import StatCard from '../components/StatCard';
import { useToast } from '../components/Toast';
import { MONTH_NAMES, normalizeStatus, formatTanggal } from '../lib/utils';

const C = {
  purple: '#7c3aed',
  indigo: '#6366f1',
  blue: '#0284c7',
  cyan: '#06b6d4',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
  grid: '#edf0f7',
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 640
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat Pagi';
  if (h < 15) return 'Selamat Siang';
  if (h < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

const KATEGORI = ['Info', 'Penting', 'Event'];

// Modern Glass Chart Tooltip
function ModernTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '10px 14px',
        boxShadow: '0 10px 25px -4px rgba(124, 58, 237, 0.12)',
        fontSize: 12,
      }}
    >
      {label && (
        <div style={{ fontWeight: 700, color: '#1e1b4b', marginBottom: 6 }}>
          Bulan {label}
        </div>
      )}
      {payload.map((item, idx) => {
        const color = item.color || item.payload?.fill || '#7c3aed';
        return (
          <div
            key={item.name || idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              marginTop: 3,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                }}
              />
              {item.name}:
            </span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.value} pengajuan</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { master, izin, lembur, pengumuman, addPengumuman, updatePengumuman, deletePengumuman } =
    useAppStore();
  const notify = useToast();
  const isMobile = useIsMobile();
  const composerRef = useRef(null);

  // Time range filter for chart (3, 6, 12 months)
  const [chartRange, setChartRange] = useState(12);

  // Announcement composer state
  const [showComposer, setShowComposer] = useState(false);
  const [annForm, setAnnForm] = useState({
    judul: '',
    isi_pesan: '',
    label_kategori: 'Info',
    tanggal: new Date().toISOString().split('T')[0],
  });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const resetAnnForm = () => {
    setAnnForm({
      judul: '',
      isi_pesan: '',
      label_kategori: 'Info',
      tanggal: new Date().toISOString().split('T')[0],
    });
    setEditingId(null);
    setShowComposer(false);
  };

  const handleOpenComposer = () => {
    setShowComposer(true);
    setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleAnnSubmit = async (e) => {
    e.preventDefault();
    if (!annForm.judul.trim()) {
      notify('Judul pengumuman wajib diisi!', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updatePengumuman(editingId, annForm);
        notify('Pengumuman berhasil diperbarui.', 'success');
      } else {
        await addPengumuman(annForm);
        notify('Pengumuman berhasil dipublikasikan.', 'success');
      }
      resetAnnForm();
    } catch (err) {
      console.error(err);
      notify('Gagal menyimpan pengumuman.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAnnEdit = (a) => {
    setEditingId(a.id);
    setAnnForm({
      judul: a.judul || '',
      isi_pesan: a.isi_pesan || '',
      label_kategori: a.label_kategori || 'Info',
      tanggal: a.tanggal || '',
    });
    setShowComposer(true);
    setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleAnnDelete = async (a) => {
    if (!window.confirm(`Hapus pengumuman "${a.judul}"?`)) return;
    try {
      await deletePengumuman(a.id);
      notify('Pengumuman dihapus.', 'success');
      if (editingId === a.id) resetAnnForm();
    } catch (err) {
      console.error(err);
      notify('Gagal menghapus pengumuman.', 'error');
    }
  };

  // Metrics
  const izinPending = izin.filter((x) => normalizeStatus(x.status) === 'PENDING').length;
  const lemburPending = lembur.filter((x) => normalizeStatus(x.status) === 'PENDING').length;
  const izinApproved = izin.filter((x) => normalizeStatus(x.status) === 'APPROVED').length;
  const lemburApproved = lembur.filter((x) => normalizeStatus(x.status) === 'APPROVED').length;
  const totalIzin = izin.length;
  const totalLembur = lembur.length;
  const totalPengajuan = totalIzin + totalLembur;
  const totalApproved = izinApproved + lemburApproved;

  const approvalRate = totalPengajuan > 0 ? Math.round((totalApproved / totalPengajuan) * 100) : 100;

  // Total jam lembur terakumulasi
  const totalHoursLembur = useMemo(() => {
    const sum = lembur.reduce((acc, l) => {
      const h = parseFloat(l.jam_lembur) || parseFloat(l.total_jam) || parseFloat(l.durasi) || 0;
      return acc + h;
    }, 0);
    return Math.round(sum * 10) / 10;
  }, [lembur]);

  // Chart data based on range (3, 6, 12 months)
  const monthly = useMemo(() => {
    const now = new Date();
    const out = [];
    for (let i = chartRange - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = MONTH_NAMES[d.getMonth()].slice(0, 3);
      out.push({
        name: label,
        Izin: izin.filter((x) => (x.tanggal_izin_mulai || '').startsWith(key)).length,
        Lembur: lembur.filter((x) => (x.tanggal_lembur || '').startsWith(key)).length,
      });
    }
    return out;
  }, [izin, lembur, chartRange]);

  // Donut: distribusi status (gabungan izin + lembur)
  const donutData = useMemo(() => {
    const status = (arr) => ({
      ok: arr.filter((x) => normalizeStatus(x.status) === 'APPROVED').length,
      pend: arr.filter((x) => normalizeStatus(x.status) === 'PENDING').length,
      tolak: arr.filter((x) => normalizeStatus(x.status) === 'REJECTED').length,
    });
    const s = { izin: status(izin), lembur: status(lembur) };
    return [
      { name: 'Disetujui', value: s.izin.ok + s.lembur.ok, fill: C.emerald },
      { name: 'Menunggu', value: s.izin.pend + s.lembur.pend, fill: C.amber },
      { name: 'Ditolak', value: s.izin.tolak + s.lembur.tolak, fill: C.rose },
    ].filter((x) => x.value > 0);
  }, [izin, lembur]);

  const donutTotal = donutData.reduce((a, b) => a + b.value, 0);

  // Leaderboard: top jam lembur
  const topLembur = useMemo(() => {
    const map = new Map();
    for (const l of lembur) {
      const key = l.nama || l.id_karyawan || '-';
      const h = parseFloat(l.jam_lembur) || parseFloat(l.total_jam) || parseFloat(l.durasi) || 0;
      map.set(key, (map.get(key) || 0) + h);
    }
    return Array.from(map.entries())
      .map(([name, jam]) => ({ name, jam: Math.round(jam * 10) / 10 }))
      .sort((a, b) => b.jam - a.jam)
      .slice(0, 5);
  }, [lembur]);

  const maxJam = topLembur.length ? topLembur[0].jam : 1;

  const todayStr = formatTanggal(new Date(), 'full');

  return (
    <div className="dash-container">
      {/* =========================================================
          1. Hero Greeting Banner (Inspired by AI Assistant Ref)
          ========================================================= */}
      <section className="dash-hero">
        <div className="dash-hero-content">
          <div className="dash-hero-greeting-pill">
            <Sparkles size={14} />
            <span>{getGreeting()}, HR Admin</span>
          </div>

          <h2 className="dash-hero-title">
            Kelola Kehadiran & Aktivitas Tim Arasa
          </h2>

          <p className="dash-hero-desc">
            Pantau ringkasan pengajuan izin, jadwal lembur, serta kelola pengumuman karyawan
            secara real-time dalam satu tampilan terpadu.
          </p>

          <div className="dash-hero-mobile-meta">
            <span className="hero-meta-chip">
              <span className="hero-meta-dot" />
              {approvalRate}% Disetujui
            </span>
            <span className="hero-meta-chip">
              {master.length} Karyawan
            </span>
            <span className="hero-meta-chip">
              {todayStr}
            </span>
          </div>

          <div className="dash-hero-actions">
            <button
              type="button"
              className="dash-hero-btn-primary"
              onClick={handleOpenComposer}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Buat Pengumuman</span>
            </button>

            <NavLink to="/approval" className="dash-hero-btn-secondary">
              <span>{izinPending + lemburPending > 0 ? `${izinPending + lemburPending} Butuh Review` : 'Tinjau Approval'}</span>
              <ArrowRight size={14} />
            </NavLink>
          </div>
        </div>

        {/* Hero Glass Widget */}
        <div className="dash-hero-widget">
          <div className="dash-hero-widget-header">
            <span className="dash-hero-widget-title">Status Sistem</span>
            <span className="dash-hero-widget-live">
              <span className="dash-hero-widget-live-dot" />
              Realtime
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: -6 }}>
            {todayStr}
          </div>

          <div className="dash-hero-widget-metric">
            {approvalRate}%
          </div>
          <div className="dash-hero-widget-sub">
            Tingkat persetujuan pengajuan ({totalApproved} dari {totalPengajuan} disetujui)
          </div>
        </div>
      </section>

      {/* =========================================================
          2. Stat Cards Grid (Modern Squircle Pastel Cards)
          ========================================================= */}
      <section className="dash-stats-grid">
        <StatCard
          label="Total Karyawan"
          value={master.length}
          icon={Users}
          tone="purple"
          badge="Aktif"
          foot={`${master.length} personil terdaftar`}
        />

        <StatCard
          label="Pending Izin"
          value={izinPending}
          icon={FileText}
          tone="amber"
          badge={izinPending > 0 ? `${izinPending} Menunggu` : 'Beres'}
          foot={`${izinApproved} izin disetujui`}
        />

        <StatCard
          label="Pending Lembur"
          value={lemburPending}
          icon={Flame}
          tone="rose"
          badge={lemburPending > 0 ? `${lemburPending} Menunggu` : 'Beres'}
          foot={`${lemburApproved} lembur disetujui`}
        />

        <StatCard
          label="Total Pengajuan"
          value={totalPengajuan}
          icon={TrendingUp}
          tone="emerald"
          badge="Semua"
          foot={`${totalIzin} izin · ${totalLembur} lembur`}
        />
      </section>

      {/* =========================================================
          3. Charts Section (Inspired by Reference Screen 6)
          ========================================================= */}
      <section className="dash-charts-grid">
        {/* Main Area Chart Card */}
        <div className="dash-panel">
          <div className="panel-head">
            <div className="panel-title-wrap">
              <h3>Tren Pengajuan</h3>
              <p className="panel-sub">Volume izin & lembur dalam rentang waktu</p>
            </div>

            {/* Segmented Pill Selector (Daily/Monthly/Yearly style) */}
            <div className="segmented-control">
              <button
                type="button"
                className={`segment-btn ${chartRange === 3 ? 'active' : ''}`}
                onClick={() => setChartRange(3)}
              >
                3 Bulan
              </button>
              <button
                type="button"
                className={`segment-btn ${chartRange === 6 ? 'active' : ''}`}
                onClick={() => setChartRange(6)}
              >
                6 Bulan
              </button>
              <button
                type="button"
                className={`segment-btn ${chartRange === 12 ? 'active' : ''}`}
                onClick={() => setChartRange(12)}
              >
                12 Bulan
              </button>
            </div>
          </div>

          {/* Quick Highlight Metric Pills (Ref Screen 6) */}
          <div className="metric-pills-row">
            <div className="metric-pill-card metric-pill-blue">
              <div className="metric-pill-icon">
                <Clock size={20} strokeWidth={2.2} />
              </div>
              <div>
                <div className="metric-pill-val">{totalHoursLembur} Jam</div>
                <div className="metric-pill-label">Total Lembur Terakumulasi</div>
              </div>
            </div>

            <div className="metric-pill-card metric-pill-purple">
              <div className="metric-pill-icon">
                <CheckCircle2 size={20} strokeWidth={2.2} />
              </div>
              <div>
                <div className="metric-pill-val">{totalApproved} Disetujui</div>
                <div className="metric-pill-label">Pengajuan Berhasil Diproses</div>
              </div>
            </div>
          </div>

          <div style={{ width: '100%', minHeight: isMobile ? 220 : 280 }}>
            <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
              <AreaChart
                data={monthly}
                margin={{ top: 10, right: 10, left: isMobile ? -20 : -5, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gIzinModern" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.blue} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLemburModern" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.purple} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.purple} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: isMobile ? 10 : 12, fill: C.slate }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: C.slate }}
                  axisLine={false}
                  tickLine={false}
                  width={isMobile ? 24 : 32}
                />
                <Tooltip content={<ModernTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Izin"
                  stroke={C.blue}
                  strokeWidth={3}
                  fill="url(#gIzinModern)"
                  dot={false}
                  activeDot={{ r: 5, fill: C.blue, strokeWidth: 2, stroke: '#ffffff' }}
                />
                <Area
                  type="monotone"
                  dataKey="Lembur"
                  stroke={C.purple}
                  strokeWidth={3}
                  fill="url(#gLemburModern)"
                  dot={false}
                  activeDot={{ r: 5, fill: C.purple, strokeWidth: 2, stroke: '#ffffff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="chart-legend">
              <span className="chart-legend-item">
                <i style={{ background: C.blue }} /> Izin & Cuti
              </span>
              <span className="chart-legend-item">
                <i style={{ background: C.purple }} /> Lembur
              </span>
            </div>
          </div>
        </div>

        {/* Donut Chart Card */}
        <div className="dash-panel">
          <div className="panel-head">
            <div className="panel-title-wrap">
              <h3>Distribusi Status</h3>
              <p className="panel-sub">Total pengajuan izin & lembur</p>
            </div>
          </div>

          {donutData.length === 0 ? (
            <div className="empty-state-modern">
              <div className="empty-state-icon">
                <FileText size={22} />
              </div>
              <p className="empty-state-text">Belum ada pengajuan masuk.</p>
            </div>
          ) : (
            <div className="donut-wrap">
              <div style={{ width: '100%', minHeight: isMobile ? 190 : 220 }}>
                <ResponsiveContainer width="100%" height={isMobile ? 190 : 220}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={isMobile ? 54 : 68}
                      outerRadius={isMobile ? 84 : 100}
                      paddingAngle={4}
                      strokeWidth={0}
                      cornerRadius={8}
                    >
                      {donutData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<ModernTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="donut-center">
                <span className="donut-center-val">{donutTotal}</span>
                <span className="donut-center-label">Pengajuan</span>
              </div>

              <div className="donut-legend">
                {donutData.map((d) => (
                  <div key={d.name} className="donut-legend-row">
                    <span className="donut-dot" style={{ background: d.fill }} />
                    <span className="donut-legend-name">{d.name}</span>
                    <span className="donut-legend-val">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================
          4. Bottom Section: Top Lembur & Papan Informasi
          ========================================================= */}
      <section className="dash-bottom-grid">
        {/* Top Karyawan Lembur */}
        <div className="dash-panel">
          <div className="panel-head">
            <div className="panel-title-wrap">
              <h3>Top Jam Lembur</h3>
              <p className="panel-sub">Personil dengan akumulasi tertinggi</p>
            </div>
            <Award size={20} color={C.amber} />
          </div>

          {topLembur.length === 0 ? (
            <div className="empty-state-modern">
              <div className="empty-state-icon">
                <Clock size={22} />
              </div>
              <p className="empty-state-text">Belum ada catatan lembur yang tercatat.</p>
            </div>
          ) : (
            <div className="leaderboard-list">
              {topLembur.map((r, i) => {
                const rankClass =
                  i === 0
                    ? 'leader-rank-1'
                    : i === 1
                    ? 'leader-rank-2'
                    : i === 2
                    ? 'leader-rank-3'
                    : 'leader-rank-other';

                const initials =
                  String(r.name || 'K')
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => (w ? w[0] : ''))
                    .join('')
                    .toUpperCase() || 'K';

                return (
                  <div key={r.name} className="leader-item">
                    <span className={`leader-rank-badge ${rankClass}`}>
                      {i + 1}
                    </span>

                    <div className="leader-avatar-circle">{initials}</div>

                    <div className="leader-info">
                      <div className="leader-name-wrap">
                        <span className="leader-name">{r.name}</span>
                        <span className="leader-hours">{r.jam} jam</span>
                      </div>
                      <div className="leader-bar-bg">
                        <div
                          className="leader-bar-fill"
                          style={{ width: `${(r.jam / maxJam) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Papan Informasi (Pengumuman Feed) */}
        <div className="dash-panel" ref={composerRef}>
          <div className="panel-head">
            <div className="panel-title-wrap">
              <h3>Papan Informasi</h3>
              <p className="panel-sub">Pengumuman & agenda resmi perusahaan</p>
            </div>

            <button
              type="button"
              className="announce-action-btn"
              style={{ background: 'var(--primary-soft)', color: 'var(--primary-strong)', border: 'none' }}
              onClick={() => setShowComposer((v) => !v)}
            >
              {showComposer ? <X size={14} /> : <Plus size={14} />}
              <span>{showComposer ? 'Tutup Form' : 'Tulis Pengumuman'}</span>
            </button>
          </div>

          {/* Smooth Composer Box */}
          {showComposer && (
            <form className="announce-composer-box" onSubmit={handleAnnSubmit}>
              <div className="announce-composer-title">
                <Megaphone size={16} />
                <span>{editingId ? 'Edit Pengumuman' : 'Buat Pengumuman Baru'}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: 5,
                    }}
                  >
                    Judul Pengumuman *
                  </label>
                  <input
                    type="text"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      fontSize: 13,
                      outline: 'none',
                      background: '#ffffff',
                    }}
                    placeholder="Contoh: Libur Nasional & Jadwal Shift Idul Fitri"
                    value={annForm.judul}
                    onChange={(e) => setAnnForm((f) => ({ ...f, judul: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: 5,
                      }}
                    >
                      Kategori
                    </label>
                    <select
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        fontSize: 13,
                        outline: 'none',
                        background: '#ffffff',
                      }}
                      value={annForm.label_kategori}
                      onChange={(e) =>
                        setAnnForm((f) => ({ ...f, label_kategori: e.target.value }))
                      }
                    >
                      {KATEGORI.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: 5,
                      }}
                    >
                      Tanggal
                    </label>
                    <input
                      type="date"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        fontSize: 13,
                        outline: 'none',
                        background: '#ffffff',
                      }}
                      value={annForm.tanggal}
                      onChange={(e) => setAnnForm((f) => ({ ...f, tanggal: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: 5,
                    }}
                  >
                    Detail Pesan
                  </label>
                  <textarea
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      fontSize: 13,
                      outline: 'none',
                      background: '#ffffff',
                      resize: 'vertical',
                    }}
                    placeholder="Tuliskan keterangan detail pengumuman untuk seluruh karyawan..."
                    value={annForm.isi_pesan}
                    onChange={(e) => setAnnForm((f) => ({ ...f, isi_pesan: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    type="button"
                    className="announce-action-btn"
                    onClick={resetAnnForm}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="dash-hero-btn-primary"
                    style={{ padding: '8px 18px', fontSize: 12 }}
                  >
                    <Send size={13} />
                    <span>{saving ? 'Menyimpan...' : editingId ? 'Simpan' : 'Publikasikan'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Announcement Feed */}
          <div className="announce-feed">
            {pengumuman.length === 0 ? (
              <div className="empty-state-modern">
                <div className="empty-state-icon">
                  <Megaphone size={22} />
                </div>
                <p className="empty-state-text">
                  Belum ada pengumuman dipublikasikan. Buat pengumuman pertama Anda.
                </p>
              </div>
            ) : (
              pengumuman.map((a) => {
                const cat = String(a.label_kategori || 'Info').toLowerCase();
                const catClass =
                  cat === 'penting'
                    ? 'announce-cat-penting'
                    : cat === 'event'
                    ? 'announce-cat-event'
                    : 'announce-cat-info';

                return (
                  <div key={a.id} className="announce-card">
                    <div className="announce-card-top">
                      <span className={`announce-cat-pill ${catClass}`}>
                        {a.label_kategori || 'Info'}
                      </span>
                      <span className="announce-time">
                        <Calendar size={12} />
                        {formatTanggal(a.tanggal, 'long')}
                      </span>
                    </div>

                    <h4 className="announce-card-title">{a.judul}</h4>

                    {a.isi_pesan && (
                      <p className="announce-card-text">{a.isi_pesan}</p>
                    )}

                    <div className="announce-card-footer">
                      <button
                        type="button"
                        className="announce-action-btn"
                        onClick={() => handleAnnEdit(a)}
                      >
                        <Edit2 size={12} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="announce-action-btn delete"
                        onClick={() => handleAnnDelete(a)}
                      >
                        <Trash2 size={12} />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
