import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { getNama, MONTH_NAMES } from '../lib/utils';

const DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function Kalender() {
  const { izin, lembur, master } = useAppStore();
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(null);
  const [calTab, setCalTab] = useState('lembur');
  const [agendaFilter, setAgendaFilter] = useState(null);

  // Index events by date key
  const byDate = useMemo(() => {
    const map = {};
    izin.forEach((x) => {
      const start = x.tanggal_izin_mulai;
      const end = x.tanggal_izin_akhir || start;
      if (!start) return;
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s) || isNaN(e)) return;
      const cur = new Date(s);
      while (cur <= e) {
        const key = toKey(cur.getFullYear(), cur.getMonth(), cur.getDate());
        (map[key] = map[key] || []).push({ type: 'izin', data: x });
        cur.setDate(cur.getDate() + 1);
      }
    });
    lembur.forEach((x) => {
      const key = x.tanggal_lembur;
      if (!key) return;
      (map[key] = map[key] || []).push({ type: 'lembur', data: x });
    });
    return map;
  }, [izin, lembur]);

  const days = useMemo(() => {
    const { year, month } = view;
    const first = new Date(year, month, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [view]);

  const selectedEvents = selected ? byDate[selected] || [] : [];
  const lemburEvs = selectedEvents.filter((e) => e.type === 'lembur');
  const izinEvs = selectedEvents.filter((e) => e.type === 'izin');

  // Summary of current month
  const totalCounts = useMemo(() => {
    const { year, month } = view;
    let izinCount = 0;
    let lemburCount = 0;
    for (const [key, evs] of Object.entries(byDate)) {
      const [y, m] = key.split('-').map(Number);
      if (y !== year || m !== month + 1) continue;
      evs.forEach((e) => (e.type === 'izin' ? izinCount++ : lemburCount++));
    }
    return { izinCount, lemburCount };
  }, [byDate, view]);

  // Upcoming events in this month (sorted by date)
  const upcoming = useMemo(() => {
    const { year, month } = view;
    const list = [];
    Object.entries(byDate).forEach(([key, evs]) => {
      const [y, m, d] = key.split('-').map(Number);
      if (y !== year || m !== month + 1) return;
      evs.forEach((e) => list.push({ date: `${d}`, full: key, ...e }));
    });
    return list.sort((a, b) => a.full.localeCompare(b.full));
  }, [byDate, view]);

  // Group agenda by date -> count lembur & izin
  const groupedAgenda = useMemo(() => {
    const map = new Map();
    upcoming.forEach((e) => {
      if (!map.has(e.full)) {
        map.set(e.full, { date: e.date, full: e.full, lembur: 0, izin: 0 });
      }
      const g = map.get(e.full);
      if (e.type === 'lembur') g.lembur++;
      else g.izin++;
    });
    // filter by active filter (keep dates that have the matching type)
    const list = Array.from(map.values());
    if (agendaFilter) {
      return list.filter((g) => (agendaFilter === 'lembur' ? g.lembur > 0 : g.izin > 0));
    }
    return list;
  }, [upcoming, agendaFilter]);

  const prev = () =>
    setView((v) => {
      const d = new Date(v.year, v.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const next = () =>
    setView((v) => {
      const d = new Date(v.year, v.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="page-title">Kalender</h2>
          <p className="page-sub">Lihat jadwal izin &amp; lembur karyawan.</p>
        </div>
      </div>

      <div className="cal-layout">
        <div className="panel cal-main">
          <div className="calendar-head">
            <button className="btn btn-ghost btn-sm" onClick={prev}>
              ‹
            </button>
            <div className="month-title">
              {MONTH_NAMES[view.month]} {view.year}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={next}>
              ›
            </button>
          </div>

          <div className="cal-grid">
            {DOW.map((d) => (
              <div key={d} className="cal-dow">
                {d}
              </div>
            ))}
            {days.map((d, i) => {
              if (d === null) return <div key={`e${i}`} className="cal-day empty" />;
              const key = toKey(view.year, view.month, d);
              const evs = byDate[key] || [];
              const hasIzin = evs.some((e) => e.type === 'izin');
              const hasLembur = evs.some((e) => e.type === 'lembur');
              const isToday = key === toKey(today.getFullYear(), today.getMonth(), today.getDate());
              const isSelected = selected === key;
              return (
                <div
                  key={key}
                  className={`cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasIzin || hasLembur ? 'has-data' : ''}`}
                  onClick={() => {
                    setCalTab('lembur');
                    setSelected(isSelected ? null : key);
                  }}
                >
                  <span className="cal-num">{d}</span>
                  {(hasIzin || hasLembur) && (
                    <div className="cal-dots">
                      {hasIzin && <span className="cal-dot izin" />}
                      {hasLembur && <span className="cal-dot lembur" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="cal-legend">
            <span>
              <span className="cal-dot izin" /> Izin
            </span>
            <span>
              <span className="cal-dot lembur" /> Lembur
            </span>
            <span>
              <span className="cal-dot today-dot" /> Hari ini
            </span>
          </div>
        </div>

        <div className="panel cal-side">
          <h3 className="cal-side-title">Ringkasan Bulan Ini</h3>
          <div className="cal-filter-toggle">
            <button
              type="button"
              className={`filter-chip ${agendaFilter === null ? 'active' : ''}`}
              onClick={() => setAgendaFilter(null)}
            >
              Semua
            </button>
            <button
              type="button"
              className={`filter-chip ${agendaFilter === 'lembur' ? 'active' : ''}`}
              onClick={() => setAgendaFilter(agendaFilter === 'lembur' ? null : 'lembur')}
            >
              Lembur ({totalCounts.lemburCount})
            </button>
            <button
              type="button"
              className={`filter-chip ${agendaFilter === 'izin' ? 'active' : ''}`}
              onClick={() => setAgendaFilter(agendaFilter === 'izin' ? null : 'izin')}
            >
              Izin ({totalCounts.izinCount})
            </button>
          </div>

          {groupedAgenda.length === 0 ? (
            <div className="cal-agenda-empty">
              {agendaFilter
                ? `Tidak ada ${agendaFilter === 'lembur' ? 'lembur' : 'izin'} bulan ini.`
                : 'Belum ada pengajuan bulan ini.'}
            </div>
          ) : (
            <div className="cal-agenda">
              {groupedAgenda.map((g) => (
                <button
                  key={g.full}
                  className="agenda-item"
                  onClick={() => {
                    setCalTab(agendaFilter || 'lembur');
                    setSelected(selected === g.full ? null : g.full);
                  }}
                >
                  <span className="agenda-date">{g.date}</span>
                  <span className="agenda-counts">
                    {g.lembur > 0 && (
                      <span className="count-chip lembur">{g.lembur} lembur</span>
                    )}
                    {g.izin > 0 && (
                      <span className="count-chip izin">{g.izin} izin</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <Modal title={`Detail ${selected}`} onClose={() => setSelected(null)}>
          {selectedEvents.length === 0 ? (
            <div className="empty">Tidak ada pengajuan pada tanggal ini.</div>
          ) : agendaFilter ? (
            <>
              {agendaFilter === 'lembur' ? (
                lemburEvs.length === 0 ? (
                  <div className="empty">Tidak ada lembur pada tanggal ini.</div>
                ) : (
                  lemburEvs.map((ev, i) => (
                    <div key={i} className="req-card" style={{ marginBottom: 10 }}>
                      <div className="req-header">
                        <div>
                          <div className="req-title">⏰ {getNama(ev.data, master)}</div>
                          <div className="req-meta">
                            {ev.data.jam_awal || ''} - {ev.data.jam_selesai || ''}
                          </div>
                        </div>
                        <StatusBadge status={ev.data.status} />
                      </div>
                      {ev.data.durasi && (
                        <div className="req-meta">Durasi: {ev.data.durasi}</div>
                      )}
                    </div>
                  ))
                )
              ) : izinEvs.length === 0 ? (
                <div className="empty">Tidak ada izin pada tanggal ini.</div>
              ) : (
                izinEvs.map((ev, i) => (
                  <div key={i} className="req-card" style={{ marginBottom: 10 }}>
                    <div className="req-header">
                      <div>
                        <div className="req-title">📝 {getNama(ev.data, master)}</div>
                        <div className="req-meta">{ev.data.kategori_izin || '-'}</div>
                      </div>
                      <StatusBadge status={ev.data.status} />
                    </div>
                    {ev.data.alasan && <div className="req-body">{ev.data.alasan}</div>}
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              <div className="segmented detail-tabs">
                <button
                  className={`btn ${calTab === 'lembur' ? 'active' : ''}`}
                  onClick={() => setCalTab('lembur')}
                >
                  Lembur {lemburEvs.length > 0 && `(${lemburEvs.length})`}
                </button>
                <button
                  className={`btn ${calTab === 'izin' ? 'active' : ''}`}
                  onClick={() => setCalTab('izin')}
                >
                  Izin {izinEvs.length > 0 && `(${izinEvs.length})`}
                </button>
              </div>

              {calTab === 'lembur' ? (
                lemburEvs.length === 0 ? (
                  <div className="empty">Tidak ada lembur pada tanggal ini.</div>
                ) : (
                  lemburEvs.map((ev, i) => (
                    <div key={i} className="req-card" style={{ marginBottom: 10 }}>
                      <div className="req-header">
                        <div>
                          <div className="req-title">⏰ {getNama(ev.data, master)}</div>
                          <div className="req-meta">
                            {ev.data.jam_awal || ''} - {ev.data.jam_selesai || ''}
                          </div>
                        </div>
                        <StatusBadge status={ev.data.status} />
                      </div>
                      {ev.data.durasi && (
                        <div className="req-meta">Durasi: {ev.data.durasi}</div>
                      )}
                    </div>
                  ))
                )
              ) : izinEvs.length === 0 ? (
                <div className="empty">Tidak ada izin pada tanggal ini.</div>
              ) : (
                izinEvs.map((ev, i) => (
                  <div key={i} className="req-card" style={{ marginBottom: 10 }}>
                    <div className="req-header">
                      <div>
                        <div className="req-title">📝 {getNama(ev.data, master)}</div>
                        <div className="req-meta">{ev.data.kategori_izin || '-'}</div>
                      </div>
                      <StatusBadge status={ev.data.status} />
                    </div>
                    {ev.data.alasan && <div className="req-body">{ev.data.alasan}</div>}
                  </div>
                ))
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
