import { useMemo, useState, useEffect } from 'react';
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
import { useAppStore } from '../store/useAppStore';
import StatCard from '../components/StatCard';
import { useToast } from '../components/Toast';
import { MONTH_NAMES, normalizeStatus } from '../lib/utils';

const C = {
  indigo: '#4f46e5',
  blue: '#2563eb',
  green: '#16a34a',
  emerald: '#22c55e',
  amber: '#f59e0b',
  rose: '#ef4444',
  violet: '#7c3aed',
  slate: '#64748b',
  grid: '#eef1f6',
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e5e9f0',
  boxShadow: '0 8px 24px rgba(15,23,42,0.10)',
  fontSize: 12,
  padding: '8px 12px',
};

function ChartLegend({ items }) {
  return (
    <div className="chart-legend">
      {items.map((it) => (
        <span key={it.name} className="chart-legend-item">
          <i style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  );
}

const KATEGORI = ['Info', 'Penting', 'Event'];

function formatTanggal(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function badgeKategori(k) {
  const v = String(k || 'Info').toLowerCase();
  if (v === 'penting') return 'PENTING';
  if (v === 'event') return 'EVENT';
  return 'INFO';
}


export default function Dashboard() {
  const { master, izin, lembur, pengumuman, addPengumuman, updatePengumuman, deletePengumuman } = useAppStore();
  const notify = useToast();
  const isMobile = useIsMobile();

  // state form pengumuman
  const [annForm, setAnnForm] = useState({ judul: '', isi_pesan: '', label_kategori: 'Info', tanggal: '' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const resetAnnForm = () => {
    setAnnForm({ judul: '', isi_pesan: '', label_kategori: 'Info', tanggal: '' });
    setEditingId(null);
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


  const izinPending = izin.filter((x) => normalizeStatus(x.status) === 'PENDING').length;
  const lemburPending = lembur.filter((x) => normalizeStatus(x.status) === 'PENDING').length;
  const izinApproved = izin.filter((x) => normalizeStatus(x.status) === 'APPROVED').length;
  const lemburApproved = lembur.filter((x) => normalizeStatus(x.status) === 'APPROVED').length;

  // 12 bulan terakhir: jumlah izin & lembur (untuk area chart)
  const monthly = useMemo(() => {
    const now = new Date();
    const out = [];
    for (let i = 11; i >= 0; i--) {
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
  }, [izin, lembur]);

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

  // Leaderboard: total jam lembur per karyawan (approved + pending)
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

  const totalIzin = izin.length;
  const totalLembur = lembur.length;

  return (
    <div className="dash">
      <div className="page-head">
        <div>
          <h2 className="page-title">Overview</h2>
          <p className="page-sub">Ringkasan aktivitas HR kamu secara real-time.</p>
        </div>
      </div>

      <div className="grid-4 dash-stats">
        <StatCard label="Total Karyawan" value={master.length} icon="👥" tone="indigo" foot={`${master.length} aktif`} />
        <StatCard label="Pending Izin" value={izinPending} icon="📝" tone="amber" foot={`${izinApproved} disetujui`} />
        <StatCard label="Pending Lembur" value={lemburPending} icon="⏰" tone="amber" foot={`${lemburApproved} disetujui`} />
        <StatCard
          label="Total Pengajuan"
          value={totalIzin + totalLembur}
          icon="📊"
          tone="green"
          foot={`${totalIzin} izin · ${totalLembur} lembur`}
        />
      </div>


      <div className="panel dash-panel announce-panel">
        <div className="panel-head">
          <div>
            <h3>📌 Papan Informasi</h3>
            <p className="panel-sub">Kelola pengumuman yang tampil di portal karyawan.</p>
          </div>
        </div>

        <form className="announce-form" onSubmit={handleAnnSubmit}>
          <div className="field">
            <label>Judul Pengumuman <span className="req">*</span></label>
            <input
              type="text"
              placeholder="Contoh: Libur Nasional & Jadwal Kerja"
              value={annForm.judul}
              onChange={(e) => setAnnForm((f) => ({ ...f, judul: e.target.value }))}
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Kategori</label>
              <select
                value={annForm.label_kategori}
                onChange={(e) => setAnnForm((f) => ({ ...f, label_kategori: e.target.value }))}
              >
                {KATEGORI.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tanggal</label>
              <input
                type="date"
                value={annForm.tanggal}
                onChange={(e) => setAnnForm((f) => ({ ...f, tanggal: e.target.value }))}
              />
            </div>
          </div>
          <div className="field">
            <label>Isi Pesan</label>
            <textarea
              rows={3}
              placeholder="Tulis detail pengumuman di sini…"
              value={annForm.isi_pesan}
              onChange={(e) => setAnnForm((f) => ({ ...f, isi_pesan: e.target.value }))}
            />
          </div>
          <div className="announce-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Menyimpan…' : editingId ? 'Simpan Perubahan' : 'Publikasikan'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={resetAnnForm}>
                Batal
              </button>
            )}
          </div>
        </form>

        <div className="announce-list">
          {pengumuman.length === 0 ? (
            <div className="empty-card">
              <div className="empty-ico">📢</div>
              <p>Belum ada pengumuman. Publikasikan yang pertama.</p>
            </div>
          ) : (
            pengumuman.map((a) => (
              <div key={a.id} className="announce-item">
                <div className="announce-body">
                  <div className="announce-top">
                    <span className={`announce-badge ${badgeKategori(a.label_kategori)}`}>
                      {a.label_kategori || 'Info'}
                    </span>
                    <span className="announce-date">{formatTanggal(a.tanggal)}</span>
                  </div>
                  <h4 className="announce-title">{a.judul}</h4>
                  {a.isi_pesan && <p className="announce-text">{a.isi_pesan}</p>}
                </div>
                <div className="announce-item-actions">
                  <button className="btn btn-sm btn-ghost" onClick={() => handleAnnEdit(a)}>
                    Edit
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleAnnDelete(a)}>
                    Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid-2 dash-charts">
        <div className="panel dash-panel">
          <div className="panel-head">
            <div>
              <h3>Aktivitas 12 Bulan</h3>
              <p className="panel-sub">Tren pengajuan izin & lembur</p>
            </div>
            <ChartLegend
              items={[
                { name: 'Izin', color: C.blue },
                { name: 'Lembur', color: C.indigo },
              ]}
            />
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <AreaChart data={monthly} margin={{ top: 10, right: 8, left: isMobile ? -18 : 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gIzin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLembur" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.indigo} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={C.indigo} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: isMobile ? 9 : 11, fill: C.slate }}
                axisLine={false}
                tickLine={false}
                interval={isMobile ? 1 : 0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: C.slate }}
                axisLine={false}
                tickLine={false}
                width={isMobile ? 20 : 30}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#c7d2fe' }} />
              <Area type="monotone" dataKey="Izin" stroke={C.blue} strokeWidth={2.5} fill="url(#gIzin)" dot={false} activeDot={{ r: 4 }} />
              <Area type="monotone" dataKey="Lembur" stroke={C.indigo} strokeWidth={2.5} fill="url(#gLembur)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel dash-panel">
          <div className="panel-head">
            <div>
              <h3>Distribusi Status</h3>
              <p className="panel-sub">Gabungan izin & lembur</p>
            </div>
          </div>
          {donutData.length === 0 ? (
            <div className="empty">Belum ada data pengajuan.</div>
          ) : (
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={isMobile ? 52 : 70}
                    outerRadius={isMobile ? 84 : 108}
                    paddingAngle={3}
                    strokeWidth={0}
                    cornerRadius={6}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <span className="donut-center-val">{donutTotal}</span>
                <span className="donut-center-label">Total</span>
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
      </div>

      <div className="panel dash-panel">
        <div className="panel-head">
          <div>
            <h3>Top Karyawan Lembur</h3>
            <p className="panel-sub">Akumulasi jam lembur tertinggi</p>
          </div>
        </div>
        {topLembur.length === 0 ? (
          <div className="empty">Belum ada data lembur.</div>
        ) : (
          <div className="leaderboard">
            {topLembur.map((r, i) => (
              <div key={r.name} className="leader-row">
                <span className="leader-rank">{i + 1}</span>
                <span className="leader-name">{r.name}</span>
                <div className="leader-bar">
                  <div
                    className="leader-fill"
                    style={{ width: `${(r.jam / maxJam) * 100}%` }}
                  />
                </div>
                <span className="leader-val">{r.jam} jam</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
