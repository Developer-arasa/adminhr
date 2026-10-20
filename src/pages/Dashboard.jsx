import { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import StatCard from '../components/StatCard';
import { MONTH_NAMES, normalizeStatus } from '../lib/utils';

const PIE_COLORS = { izin: '#2563eb', lembur: '#4f46e5' };

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

export default function Dashboard() {
  const { master, izin, lembur } = useAppStore();
  const isMobile = useIsMobile();

  const izinPending = izin.filter((x) => normalizeStatus(x.status) === 'PENDING').length;
  const lemburPending = lembur.filter((x) => normalizeStatus(x.status) === 'PENDING').length;

  // Bar chart: jumlah izin & lembur per bulan (12 bulan terakhir)
  const monthly = useMemo(() => {
    const now = new Date();
    const out = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = MONTH_NAMES[d.getMonth()].slice(0, 3);
      const izinCount = izin.filter((x) =>
        (x.tanggal_izin_mulai || '').startsWith(key)
      ).length;
      const lemburCount = lembur.filter((x) =>
        (x.tanggal_lembur || '').startsWith(key)
      ).length;
      out.push({ name: label, Izin: izinCount, Lembur: lemburCount });
    }
    return out;
  }, [izin, lembur]);

  // Donut: distribusi status izin + lembur
  const donutData = useMemo(() => {
    const izinOk = izin.filter((x) => normalizeStatus(x.status) === 'APPROVED').length;
    const izinTolak = izin.filter((x) => normalizeStatus(x.status) === 'REJECTED').length;
    const izinP = izin.filter((x) => normalizeStatus(x.status) === 'PENDING').length;
    const lemburOk = lembur.filter((x) => normalizeStatus(x.status) === 'APPROVED').length;
    const lemburTolak = lembur.filter((x) => normalizeStatus(x.status) === 'REJECTED').length;
    const lemburP = lembur.filter((x) => normalizeStatus(x.status) === 'PENDING').length;
    return [
      { name: 'Izin Disetujui', value: izinOk, fill: '#22c55e' },
      { name: 'Izin Ditolak', value: izinTolak, fill: '#ef4444' },
      { name: 'Izin Pending', value: izinP, fill: '#f59e0b' },
      { name: 'Lembur Disetujui', value: lemburOk, fill: '#4f46e5' },
      { name: 'Lembur Ditolak', value: lemburTolak, fill: '#fb7185' },
      { name: 'Lembur Pending', value: lemburP, fill: '#a5b4fc' },
    ].filter((x) => x.value > 0);
  }, [izin, lembur]);

  const totalIzin = izin.length;
  const totalLembur = lembur.length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="page-title">Overview</h2>
          <p className="page-sub">Ringkasan aktivitas HR kamu hari ini.</p>
        </div>
      </div>

      <div className="grid-4">
        <StatCard label="Total Karyawan" value={master.length} icon="👥" tone="indigo" />
        <StatCard label="Pending Izin" value={izinPending} icon="📝" tone="amber" />
        <StatCard label="Pending Lembur" value={lemburPending} icon="⏰" tone="amber" />
        <StatCard
          label="Total Pengajuan"
          value={totalIzin + totalLembur}
          icon="📊"
          tone="green"
          foot={`${totalIzin} izin · ${totalLembur} lembur`}
        />
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3 style={{ marginBottom: 12, fontSize: 14 }}>Aktivitas 12 Bulan</h3>
          <ResponsiveContainer width="100%" height={isMobile ? 200 : 280}>
            <BarChart data={monthly} barGap={2} margin={isMobile ? { left: -12, right: 0 } : undefined}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: isMobile ? 9 : 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                interval={isMobile ? 1 : 0}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={isMobile ? 20 : 28} />
              <Tooltip
                cursor={{ fill: '#f1f3f7' }}
                contentStyle={{ borderRadius: 10, border: '1px solid #e5e9f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Izin" fill={PIE_COLORS.izin} radius={[4, 4, 0, 0]} maxBarSize={isMobile ? 12 : 20} />
              <Bar dataKey="Lembur" fill={PIE_COLORS.lembur} radius={[4, 4, 0, 0]} maxBarSize={isMobile ? 12 : 20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 12, fontSize: 14 }}>Distribusi Status</h3>
          {donutData.length === 0 ? (
            <div className="empty">Belum ada data pengajuan.</div>
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={isMobile ? 48 : 62}
                  outerRadius={isMobile ? 78 : 100}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e9f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

