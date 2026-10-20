import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAppStore } from '../store/useAppStore';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { getNama, formatTeksJam, getMonthStringFromDate, MONTH_NAMES, normalizeStatus } from '../lib/utils';

export default function Rekap() {
  const { izin, lembur, master } = useAppStore();
  const notify = useToast();
  const [tab, setTab] = useState('izin');
  const [bulan, setBulan] = useState('ALL');
  const [search, setSearch] = useState('');

  const year = new Date().getFullYear();
  const months = useMemo(() => {
    const set = new Set([year]);
    izin.forEach((x) => {
      const p = String(x.tanggal_izin_mulai || '').split('-');
      if (p[0] && !isNaN(parseInt(p[0]))) set.add(parseInt(p[0]));
    });
    lembur.forEach((x) => {
      const p = String(x.tanggal_lembur || '').split('-');
      if (p[0] && !isNaN(parseInt(p[0]))) set.add(parseInt(p[0]));
    });
    const out = [];
    Array.from(set)
      .sort()
      .forEach((y) => MONTH_NAMES.forEach((m) => out.push(`${m} ${y}`)));
    return out;
  }, [izin, lembur, year]);

  const filteredIzin = izin.filter((x) => {
    const nm = getNama(x, master).toLowerCase();
    const idK = (x.id_karyawan || '').toLowerCase();
    const matchSearch = nm.includes(search.toLowerCase()) || idK.includes(search.toLowerCase());
    const matchBulan = bulan === 'ALL' || getMonthStringFromDate(x.tanggal_izin_mulai) === bulan;
    return normalizeStatus(x.status) !== 'PENDING' && matchSearch && matchBulan;
  });

  const filteredLembur = lembur.filter((x) => {
    const nm = getNama(x, master).toLowerCase();
    const idK = (x.id_karyawan || '').toLowerCase();
    const matchSearch = nm.includes(search.toLowerCase()) || idK.includes(search.toLowerCase());
    const matchBulan = bulan === 'ALL' || (x.bulan_lembur || '').trim() === bulan;
    return normalizeStatus(x.status) !== 'PENDING' && matchSearch && matchBulan;
  });

  const exportData = (type) => {
    let rawData = [];
    let summaryData = [];
    let fileName = '';

    if (type === 'izin') {
      if (!filteredIzin.length) return notify('❌ Data kosong, tidak ada laporan yang bisa dicetak.');
      rawData = filteredIzin.map((i) => ({
        'ID Karyawan': i.id_karyawan,
        'Nama Karyawan': getNama(i, master),
        'Tgl Mulai': i.tanggal_izin_mulai,
        'Tgl Akhir': i.tanggal_izin_akhir,
        Kategori: i.kategori_izin,
        Alasan: i.alasan,
        Status: i.status,
      }));
      const grp = {};
      filteredIzin.forEach((x) => {
        const nm = getNama(x, master);
        if (!grp[nm]) grp[nm] = { id: x.id_karyawan, disetujui: 0, ditolak: 0 };
        if (normalizeStatus(x.status) === 'REJECTED') grp[nm].ditolak += 1;
        else grp[nm].disetujui += 1;
      });
      for (const n in grp) {
        summaryData.push({
          'ID Karyawan': grp[n].id,
          'Nama Karyawan': n,
          'Total Disetujui': grp[n].disetujui,
          'Total Ditolak': grp[n].ditolak,
        });
      }
      fileName = `Laporan_Izin_Arasa_${bulan.replace(/\s/g, '_')}.xlsx`;
    } else {
      if (!filteredLembur.length) return notify('❌ Data kosong, tidak ada laporan yang bisa dicetak.');
      rawData = filteredLembur.map((l) => ({
        'ID Karyawan': l.id_karyawan,
        'Nama Karyawan': getNama(l, master),
        'Tanggal Lembur': l.tanggal_lembur,
        'Jam Awal': l.jam_awal,
        'Jam Selesai': l.jam_selesai,
        'Durasi (Jam)': parseFloat(l.durasi) || 0,
        Alasan: l.alasan,
        'Bulan Rekap': l.bulan_lembur,
        Status: l.status,
      }));
      const grp = {};
      filteredLembur.forEach((x) => {
        const nm = getNama(x, master);
        const dVal = parseFloat(x.durasi) || 0;
        if (!grp[nm]) grp[nm] = { id: x.id_karyawan, setuju: 0, tolak: 0 };
        if (normalizeStatus(x.status) === 'APPROVED') grp[nm].setuju += dVal;
        else if (normalizeStatus(x.status) === 'REJECTED') grp[nm].tolak += dVal;
      });
      for (const n in grp) {
        summaryData.push({
          'ID Karyawan': grp[n].id,
          'Nama Karyawan': n,
          'Total Jam Disetujui': grp[n].setuju,
          'Total Jam Ditolak': grp[n].tolak,
        });
      }
      fileName = `Laporan_Lembur_Arasa_${bulan.replace(/\s/g, '_')}.xlsx`;
    }

    const wb = XLSX.utils.book_new();
    const wsDetail = XLSX.utils.json_to_sheet(rawData);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsDetail['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 }];
    wsSummary['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Data');
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Rangkuman Karyawan');
    XLSX.writeFile(wb, fileName);
    notify('Laporan berhasil diunduh!');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="page-title">Rekap &amp; Laporan</h2>
          <p className="page-sub">Rekap pengajuan &amp; ekspor ke Excel.</p>
        </div>
      </div>

      <div className="segmented" style={{ marginBottom: 16 }}>
        <button className={`btn ${tab === 'izin' ? 'active' : ''}`} onClick={() => setTab('izin')}>
          Izin
        </button>
        <button className={`btn ${tab === 'lembur' ? 'active' : ''}`} onClick={() => setTab('lembur')}>
          Lembur
        </button>
      </div>

      <div className="panel">
        <div className="toolbar">
          <select value={bulan} onChange={(e) => setBulan(e.target.value)}>
            <option value="ALL">Semua Bulan</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input type="text" placeholder="Cari nama / ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <button className="btn btn-outline btn-block" style={{ marginBottom: 16 }} onClick={() => exportData(tab)}>
          ⬇ Download Laporan {tab.toUpperCase()} (Excel)
        </button>

        {tab === 'izin' ? (
          filteredIzin.length === 0 ? (
            <div className="empty">Data tidak ditemukan.</div>
          ) : (
            <div className="rekap-list">
              {filteredIzin.map((i) => (
                <div className="rekap-card" key={i.id}>
                  <div className="rekap-left">
                    <span className="rekap-name">{getNama(i, master)}</span>
                    <span className="rekap-id">#{i.id_karyawan}</span>
                  </div>
                  <div className="rekap-right">
                    <div className="rekap-top">
                      <span className="type-chip blue">{i.kategori_izin || '-'}</span>
                      <StatusBadge status={i.status} />
                    </div>
                    <div className="rekap-date">
                      {i.tanggal_izin_mulai} s/d {i.tanggal_izin_akhir}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredLembur.length === 0 ? (
          <div className="empty">Data tidak ditemukan.</div>
        ) : (
          <div className="rekap-list">
            {filteredLembur.map((l) => (
              <div className="rekap-card" key={l.id}>
                <div className="rekap-left">
                  <span className="rekap-name">{getNama(l, master)}</span>
                  <span className="rekap-id">#{l.id_karyawan}</span>
                </div>
                <div className="rekap-right">
                  <div className="rekap-top">
                    <span className="type-chip indigo">
                      {l.jam_awal || '-'} - {l.jam_selesai || '-'}
                    </span>
                    <StatusBadge status={l.status} />
                  </div>
                  <div className="rekap-date">
                    {l.tanggal_lembur} · {formatTeksJam(l.durasi)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

