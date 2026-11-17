import { useMemo, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Search,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  Building2,
  ArrowUpDown,
  RotateCcw,
  Eye,
  X,
  UserCheck,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import {
  getNama,
  formatTeksJam,
  getMonthStringFromDate,
  MONTH_NAMES,
  normalizeStatus,
  daySpan,
  getHariPotongCuti,
  formatTanggal,
  formatRentangTanggal,
  formatRentangJam,
} from '../lib/utils';

export default function Rekap() {
  const { izin, lembur, master } = useAppStore();
  const notify = useToast();

  // Current date markers
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-indexed

  // --- 1. Sederhana: Filter State (Default ke Bulan Ini) ---
  const [activeTab, setActiveTab] = useState('karyawan'); // 'karyawan' | 'izin' | 'lembur'
  const [period, setPeriod] = useState('THIS_MONTH'); // 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'ALL' | custom 'Bulan YYYY'
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('DECIDED'); // 'DECIDED' | 'APPROVED' | 'REJECTED' | 'ALL'
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('nama_asc');
  const [onlyActiveEmployees, setOnlyActiveEmployees] = useState(false);

  // Modal Detail Karyawan
  const [drilldownEmp, setDrilldownEmp] = useState(null);
  const [drilldownSubTab, setDrilldownSubTab] = useState('izin');

  // Perhitungan Bulan Lalu
  const lastMonthNum = curMonth === 0 ? 11 : curMonth - 1;
  const lastMonthYear = curMonth === 0 ? curYear - 1 : curYear;
  const lastMonthString = `${MONTH_NAMES[lastMonthNum]} ${lastMonthYear}`;
  const thisMonthString = `${MONTH_NAMES[curMonth]} ${curYear}`;

  // --- 2. Daftar Bulan yang Tersedia (Diurutkan Terbaru ke Terlama) ---
  const availableMonths = useMemo(() => {
    const set = new Set();
    const addDate = (d) => {
      const s = getMonthStringFromDate(d);
      if (s && s !== '-') set.add(s);
    };
    izin.forEach((x) => addDate(x.tanggal_izin_mulai));
    lembur.forEach((x) => {
      addDate(x.tanggal_lembur);
      if (x.bulan_lembur && x.bulan_lembur.trim() !== '') {
        set.add(x.bulan_lembur.trim());
      }
    });

    // Singkirkan Bulan Ini dan Bulan Lalu dari daftar tambahan agar tidak duplikat di dropdown
    const list = Array.from(set).filter(
      (m) => m !== thisMonthString && m !== lastMonthString
    );

    return list.sort((a, b) => {
      const [mA, yA] = a.split(' ');
      const [mB, yB] = b.split(' ');
      if (yA !== yB) return parseInt(yB || 0, 10) - parseInt(yA || 0, 10);
      return MONTH_NAMES.indexOf(mB) - MONTH_NAMES.indexOf(mA);
    });
  }, [izin, lembur, thisMonthString, lastMonthString]);

  // --- 3. Daftar Divisi / Departemen ---
  const departments = useMemo(() => {
    const set = new Set();
    master.forEach((m) => {
      if (m.departemen && m.departemen.trim() !== '') {
        set.add(m.departemen.trim());
      }
    });
    return Array.from(set).sort();
  }, [master]);

  // --- 4. Helper Pencocokan Periode ---
  const matchPeriod = useCallback(
    (dateStr, bulanLemburStr = '') => {
      if (period === 'ALL') return true;

      // Pilihan bulan spesifik (misal "September 2026")
      if (period !== 'THIS_MONTH' && period !== 'LAST_MONTH' && period !== 'THIS_YEAR') {
        if (bulanLemburStr && bulanLemburStr.trim() === period) return true;
        return getMonthStringFromDate(dateStr) === period;
      }

      if (!dateStr) return false;
      const parts = String(dateStr).split('-');
      if (parts.length < 2) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (isNaN(y) || isNaN(m)) return false;

      if (period === 'THIS_MONTH') {
        return y === curYear && m === curMonth;
      }
      if (period === 'LAST_MONTH') {
        return y === lastMonthYear && m === lastMonthNum;
      }
      if (period === 'THIS_YEAR') {
        return y === curYear;
      }
      return true;
    },
    [period, curYear, curMonth, lastMonthYear, lastMonthNum]
  );

  // Label periode untuk judul & laporan
  const periodLabel = useMemo(() => {
    if (period === 'THIS_MONTH') return `Bulan Ini (${thisMonthString})`;
    if (period === 'LAST_MONTH') return `Bulan Lalu (${lastMonthString})`;
    if (period === 'THIS_YEAR') return `Tahun Ini (${curYear})`;
    if (period === 'ALL') return 'Semua Periode';
    return period;
  }, [period, thisMonthString, lastMonthString, curYear]);

  // --- 5. Filter Data Izin & Lembur ---
  const filteredIzin = useMemo(() => {
    return izin.filter((x) => {
      // Periode
      if (!matchPeriod(x.tanggal_izin_mulai)) return false;

      // Status
      const st = normalizeStatus(x.status);
      if (statusFilter === 'DECIDED' && st === 'PENDING') return false;
      if (statusFilter === 'APPROVED' && st !== 'APPROVED') return false;
      if (statusFilter === 'REJECTED' && st !== 'REJECTED') return false;

      // Divisi
      const emp = master.find((m) => m.id_karyawan === x.id_karyawan);
      const empDept = emp?.departemen || 'Umum';
      if (deptFilter !== 'ALL' && empDept !== deptFilter) return false;

      // Cari
      if (search.trim()) {
        const q = search.toLowerCase();
        const nm = getNama(x, master).toLowerCase();
        const idK = String(x.id_karyawan || '').toLowerCase();
        const als = String(x.alasan || '').toLowerCase();
        const kat = String(x.kategori_izin || '').toLowerCase();
        const dpt = empDept.toLowerCase();
        if (!nm.includes(q) && !idK.includes(q) && !als.includes(q) && !kat.includes(q) && !dpt.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [izin, master, matchPeriod, statusFilter, deptFilter, search]);

  const filteredLembur = useMemo(() => {
    return lembur.filter((x) => {
      // Periode
      if (!matchPeriod(x.tanggal_lembur, x.bulan_lembur)) return false;

      // Status
      const st = normalizeStatus(x.status);
      if (statusFilter === 'DECIDED' && st === 'PENDING') return false;
      if (statusFilter === 'APPROVED' && st !== 'APPROVED') return false;
      if (statusFilter === 'REJECTED' && st !== 'REJECTED') return false;

      // Divisi
      const emp = master.find((m) => m.id_karyawan === x.id_karyawan);
      const empDept = emp?.departemen || 'Umum';
      if (deptFilter !== 'ALL' && empDept !== deptFilter) return false;

      // Cari
      if (search.trim()) {
        const q = search.toLowerCase();
        const nm = getNama(x, master).toLowerCase();
        const idK = String(x.id_karyawan || '').toLowerCase();
        const als = String(x.alasan || '').toLowerCase();
        const dpt = empDept.toLowerCase();
        if (!nm.includes(q) && !idK.includes(q) && !als.includes(q) && !dpt.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [lembur, master, matchPeriod, statusFilter, deptFilter, search]);

  // --- 6. Kartu Ringkasan Eksekutif SDM ---
  const summaryKPI = useMemo(() => {
    let jamLemburApproved = 0;
    let sesiLembur = 0;
    let hariCutiDipotong = 0;
    let hariIzinLain = 0;

    filteredLembur.forEach((l) => {
      if (normalizeStatus(l.status) === 'APPROVED') {
        jamLemburApproved += parseFloat(l.durasi) || 0;
        sesiLembur += 1;
      }
    });

    filteredIzin.forEach((i) => {
      if (normalizeStatus(i.status) === 'APPROVED') {
        const potong = getHariPotongCuti(i);
        const total = daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir);
        hariCutiDipotong += potong;
        hariIzinLain += Math.max(0, total - potong);
      }
    });

    const totalDecided =
      filteredIzin.filter((i) => normalizeStatus(i.status) !== 'PENDING').length +
      filteredLembur.filter((l) => normalizeStatus(l.status) !== 'PENDING').length;

    const totalApproved =
      filteredIzin.filter((i) => normalizeStatus(i.status) === 'APPROVED').length +
      filteredLembur.filter((l) => normalizeStatus(l.status) === 'APPROVED').length;

    const approvalRate = totalDecided > 0 ? Math.round((totalApproved / totalDecided) * 100) : 100;

    const activeSet = new Set();
    filteredIzin.forEach((i) => i.id_karyawan && activeSet.add(i.id_karyawan));
    filteredLembur.forEach((l) => l.id_karyawan && activeSet.add(l.id_karyawan));

    return {
      jamLemburApproved: Math.round(jamLemburApproved * 10) / 10,
      sesiLembur,
      hariCutiDipotong,
      hariIzinLain,
      activeCount: activeSet.size,
      approvalRate,
    };
  }, [filteredIzin, filteredLembur]);

  // --- 7. Rekap per Karyawan (Tabel Karyawan) ---
  const employeeList = useMemo(() => {
    // Menghitung cuti terpakai sepanjang tahun berjalan
    const annualUsageMap = {};
    izin.forEach((i) => {
      if (normalizeStatus(i.status) === 'APPROVED' && i.id_karyawan) {
        const d = String(i.tanggal_izin_mulai || '');
        if (d.startsWith(String(curYear))) {
          annualUsageMap[i.id_karyawan] = (annualUsageMap[i.id_karyawan] || 0) + getHariPotongCuti(i);
        }
      }
    });

    const list = master.map((emp) => {
      const empIzin = filteredIzin.filter((i) => i.id_karyawan === emp.id_karyawan);
      const empLembur = filteredLembur.filter((l) => l.id_karyawan === emp.id_karyawan);

      let jamLemburAcc = 0;
      empLembur.forEach((l) => {
        if (normalizeStatus(l.status) === 'APPROVED') {
          jamLemburAcc += parseFloat(l.durasi) || 0;
        }
      });

      let cutiPeriodeIni = 0;
      let izinLainPeriodeIni = 0;
      empIzin.forEach((i) => {
        if (normalizeStatus(i.status) === 'APPROVED') {
          const potong = getHariPotongCuti(i);
          const total = daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir);
          cutiPeriodeIni += potong;
          izinLainPeriodeIni += Math.max(0, total - potong);
        }
      });

      const jatahAwal = emp.jatah_cuti ?? 12;
      const annualUsed = annualUsageMap[emp.id_karyawan] || 0;
      const sisaCuti = Math.max(0, jatahAwal - annualUsed);
      const totalPengajuan = empIzin.length + empLembur.length;

      // Mengumpulkan semua tanggal aktivitas periode ini untuk sorting kronologis
      const dates = [];
      empIzin.forEach((i) => {
        if (i.tanggal_izin_mulai) dates.push(String(i.tanggal_izin_mulai));
      });
      empLembur.forEach((l) => {
        if (l.tanggal_lembur) dates.push(String(l.tanggal_lembur));
      });
      dates.sort();
      const oldestActivityDate = dates.length > 0 ? dates[0] : null;
      const latestActivityDate = dates.length > 0 ? dates[dates.length - 1] : null;

      return {
        id_karyawan: emp.id_karyawan,
        nama_karyawan: emp.nama_karyawan,
        departemen: emp.departemen || 'Umum',
        jabatan: emp.jabatan || 'Karyawan',
        tgl_gabung: emp.tgl_gabung || '',
        jatahAwal,
        annualUsed,
        sisaCuti,
        cutiPeriodeIni,
        izinLainPeriodeIni,
        jamLemburAcc: Math.round(jamLemburAcc * 10) / 10,
        sesiLembur: empLembur.length,
        totalIzin: empIzin.length,
        totalPengajuan,
        hasActivity: totalPengajuan > 0,
        oldestActivityDate,
        latestActivityDate,
      };
    });

    // Filter Divisi & Search
    let result = list.filter((emp) => {
      if (deptFilter !== 'ALL' && emp.departemen !== deptFilter) return false;
      if (onlyActiveEmployees && !emp.hasActivity) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const nm = emp.nama_karyawan.toLowerCase();
        const idK = emp.id_karyawan.toLowerCase();
        const dpt = emp.departemen.toLowerCase();
        if (!nm.includes(q) && !idK.includes(q) && !dpt.includes(q)) return false;
      }
      return true;
    });

    // Sort: 2 Section (Berdasarkan Data & Berdasarkan Waktu)
    return result.sort((a, b) => {
      // 1. Berdasarkan Data (Metrik)
      if (sortBy === 'nama_asc') return a.nama_karyawan.localeCompare(b.nama_karyawan);
      if (sortBy === 'nama_desc') return b.nama_karyawan.localeCompare(a.nama_karyawan);
      if (sortBy === 'lembur_desc') return b.jamLemburAcc - a.jamLemburAcc;
      if (sortBy === 'sisa_cuti_asc') return a.sisaCuti - b.sisaCuti;
      if (sortBy === 'dept') return a.departemen.localeCompare(b.departemen);

      // 2. Berdasarkan Waktu (Kronologi)
      if (sortBy === 'time_latest') {
        if (!a.latestActivityDate && !b.latestActivityDate) return a.nama_karyawan.localeCompare(b.nama_karyawan);
        if (!a.latestActivityDate) return 1;
        if (!b.latestActivityDate) return -1;
        return b.latestActivityDate.localeCompare(a.latestActivityDate);
      }
      if (sortBy === 'time_oldest') {
        if (!a.oldestActivityDate && !b.oldestActivityDate) return a.nama_karyawan.localeCompare(b.nama_karyawan);
        if (!a.oldestActivityDate) return 1;
        if (!b.oldestActivityDate) return -1;
        return a.oldestActivityDate.localeCompare(b.oldestActivityDate);
      }
      if (sortBy === 'join_latest') {
        if (!a.tgl_gabung && !b.tgl_gabung) return a.nama_karyawan.localeCompare(b.nama_karyawan);
        if (!a.tgl_gabung) return 1;
        if (!b.tgl_gabung) return -1;
        return String(b.tgl_gabung).localeCompare(String(a.tgl_gabung));
      }

      return 0;
    });
  }, [master, filteredIzin, filteredLembur, izin, curYear, deptFilter, onlyActiveEmployees, search, sortBy]);

  // --- 8. Download Laporan Excel Utama (3 Sheet Rapi) ---
  const downloadLaporanExcel = () => {
    if (!employeeList.length && !filteredIzin.length && !filteredLembur.length) {
      return notify('Tidak ada data untuk diekspor pada filter ini.');
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Rekap Karyawan
    const sheet1Data = employeeList.map((k, idx) => ({
      No: idx + 1,
      'ID Karyawan': k.id_karyawan,
      'Nama Karyawan': k.nama_karyawan,
      Divisi: k.departemen,
      Jabatan: k.jabatan,
      'Jatah Cuti Awal': k.jatahAwal,
      'Cuti Terpakai (Periode Ini)': k.cutiPeriodeIni,
      'Sisa Saldo Cuti (Hari)': k.sisaCuti,
      'Izin Non-Potong (Hari)': k.izinLainPeriodeIni,
      'Total Lembur Disetujui (Jam)': k.jamLemburAcc,
      'Frekuensi Lembur': k.sesiLembur,
      'Frekuensi Izin': k.totalIzin,
    }));
    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    ws1['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 26 },
      { wch: 22 },
      { wch: 22 },
      { wch: 26 },
      { wch: 18 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Rekap Saldo & Lembur');

    // Sheet 2: Riwayat Izin
    const sheet2Data = filteredIzin.map((i, idx) => {
      const emp = master.find((m) => m.id_karyawan === i.id_karyawan);
      const potong = getHariPotongCuti(i);
      return {
        No: idx + 1,
        'ID Karyawan': i.id_karyawan,
        'Nama Karyawan': getNama(i, master),
        Divisi: emp?.departemen || 'Umum',
        'Tanggal Izin': formatRentangTanggal(i.tanggal_izin_mulai, i.tanggal_izin_akhir),
        'Total Hari': daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir),
        'Kategori Izin': i.kategori_izin || '-',
        'Potong Cuti': potong > 0 ? `Ya (${potong} Hari)` : 'Tidak (0 Hari)',
        Alasan: i.alasan || '-',
        Status: normalizeStatus(i.status),
      };
    });
    const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
    ws2['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 28 },
      { wch: 18 },
      { wch: 24 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 35 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Riwayat Izin & Cuti');

    // Sheet 3: Riwayat Lembur
    const sheet3Data = filteredLembur.map((l, idx) => {
      const emp = master.find((m) => m.id_karyawan === l.id_karyawan);
      return {
        No: idx + 1,
        'ID Karyawan': l.id_karyawan,
        'Nama Karyawan': getNama(l, master),
        Divisi: emp?.departemen || 'Umum',
        'Tanggal Lembur': formatTanggal(l.tanggal_lembur, 'long'),
        'Waktu Lembur': formatRentangJam(l.jam_awal, l.jam_selesai),
        'Durasi (Jam)': parseFloat(l.durasi) || 0,
        'Durasi Teks': formatTeksJam(l.durasi),
        'Pekerjaan / Alasan': l.alasan || '-',
        Status: normalizeStatus(l.status),
      };
    });
    const ws3 = XLSX.utils.json_to_sheet(sheet3Data);
    ws3['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 28 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 14 },
      { wch: 18 },
      { wch: 35 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws3, 'Riwayat Lembur');

    const cleanName = periodLabel.replace(/[\s/\\?%*:|"<>]+/g, '_');
    XLSX.writeFile(wb, `Laporan_HR_Arasa_${cleanName}.xlsx`);
    notify('Laporan Excel lengkap berhasil diunduh.');
  };

  // Unduh khusus satu orang karyawan
  const downloadRiwayatIndividu = (emp) => {
    const listIzin = filteredIzin.filter((i) => i.id_karyawan === emp.id_karyawan);
    const listLembur = filteredLembur.filter((l) => l.id_karyawan === emp.id_karyawan);

    const wb = XLSX.utils.book_new();

    const izinData = listIzin.map((i, idx) => ({
      No: idx + 1,
      'Tanggal Izin': formatRentangTanggal(i.tanggal_izin_mulai, i.tanggal_izin_akhir),
      'Durasi (Hari)': daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir),
      Kategori: i.kategori_izin,
      'Potong Cuti': getHariPotongCuti(i) > 0 ? `Ya (${getHariPotongCuti(i)} Hari)` : 'Tidak',
      Alasan: i.alasan || '-',
      Status: normalizeStatus(i.status),
    }));
    const wsIzin = XLSX.utils.json_to_sheet(izinData);
    XLSX.utils.book_append_sheet(wb, wsIzin, 'Riwayat Izin');

    const lemburData = listLembur.map((l, idx) => ({
      No: idx + 1,
      Tanggal: formatTanggal(l.tanggal_lembur, 'long'),
      Waktu: formatRentangJam(l.jam_awal, l.jam_selesai),
      'Durasi Jam': parseFloat(l.durasi) || 0,
      Keterangan: l.alasan || '-',
      Status: normalizeStatus(l.status),
    }));
    const wsLembur = XLSX.utils.json_to_sheet(lemburData);
    XLSX.utils.book_append_sheet(wb, wsLembur, 'Riwayat Lembur');

    const cleanName = emp.nama_karyawan.replace(/[\s/\\?%*:|"<>]+/g, '_');
    XLSX.writeFile(wb, `Riwayat_${cleanName}_${periodLabel.replace(/\s+/g, '_')}.xlsx`);
    notify(`Laporan ${emp.nama_karyawan} berhasil diunduh.`);
  };

  // Reset filter ke kondisi default
  const handleReset = () => {
    setPeriod('THIS_MONTH');
    setDeptFilter('ALL');
    setStatusFilter('DECIDED');
    setSearch('');
    setSortBy('nama_asc');
    setOnlyActiveEmployees(false);
    notify('Filter dikembalikan ke kondisi awal.');
  };

  // Data drilldown modal
  const drilldownData = useMemo(() => {
    if (!drilldownEmp) return { izin: [], lembur: [] };
    return {
      izin: filteredIzin.filter((i) => i.id_karyawan === drilldownEmp.id_karyawan),
      lembur: filteredLembur.filter((l) => l.id_karyawan === drilldownEmp.id_karyawan),
    };
  }, [drilldownEmp, filteredIzin, filteredLembur]);

  return (
    <div className="rekap-container">
      {/* =========================================================
         1. Header Eksekutif & 1 Tombol Utama Download Excel
         ========================================================= */}
      <div className="rekap-header-card">
        <div className="rekap-title-wrap">
          <div className="rekap-title-icon">
            <FileSpreadsheet size={26} />
          </div>
          <div className="rekap-title-text">
            <h1>Rekapitulasi Kehadiran &amp; Cuti SDM</h1>
            <p>Monitoring saldo cuti tahunan, akumulasi jam lembur, dan ekspor berkas laporan resmi.</p>
          </div>
        </div>

        <div className="rekap-header-actions">
          <button
            className="btn-export-main"
            onClick={downloadLaporanExcel}
            title="Download seluruh rekap ke file Excel 3 Sheet lengkap"
          >
            <Download size={16} />
            Unduh Rekapitulasi Excel
          </button>
        </div>
      </div>

      {/* =========================================================
         2. Ringkasan Eksekutif SDM (4 Kartu Metrik Jelas)
         ========================================================= */}
      <div className="rekap-kpi-grid">
        <div className="rekap-kpi-card">
          <div className="rekap-kpi-icon-bubble indigo">
            <Clock size={22} />
          </div>
          <div className="rekap-kpi-info">
            <span className="rekap-kpi-label">Akumulasi Jam Lembur</span>
            <span className="rekap-kpi-value">{summaryKPI.jamLemburApproved} Jam</span>
            <span className="rekap-kpi-sub">{summaryKPI.sesiLembur} sesi disetujui</span>
          </div>
        </div>

        <div className="rekap-kpi-card">
          <div className="rekap-kpi-icon-bubble emerald">
            <Calendar size={22} />
          </div>
          <div className="rekap-kpi-info">
            <span className="rekap-kpi-label">Penggunaan Cuti Tahunan</span>
            <span className="rekap-kpi-value">{summaryKPI.hariCutiDipotong} Hari</span>
            <span className="rekap-kpi-sub">
              {summaryKPI.hariIzinLain > 0 ? `+${summaryKPI.hariIzinLain} hari izin non-potong cuti` : 'Dipotong dari jatah tahunan'}
            </span>
          </div>
        </div>

        <div className="rekap-kpi-card">
          <div className="rekap-kpi-icon-bubble blue">
            <Users size={22} />
          </div>
          <div className="rekap-kpi-info">
            <span className="rekap-kpi-label">Karyawan Aktif Periode Ini</span>
            <span className="rekap-kpi-value">
              {summaryKPI.activeCount} / {master.length} Orang
            </span>
            <span className="rekap-kpi-sub">Memiliki pengajuan lembur atau cuti</span>
          </div>
        </div>

        <div className="rekap-kpi-card">
          <div className="rekap-kpi-icon-bubble amber">
            <CheckCircle2 size={22} />
          </div>
          <div className="rekap-kpi-info">
            <span className="rekap-kpi-label">Tingkat Persetujuan (Approval Rate)</span>
            <span className="rekap-kpi-value">{summaryKPI.approvalRate}%</span>
            <span className="rekap-kpi-sub">Rasio persetujuan pengajuan HR</span>
          </div>
        </div>
      </div>

      {/* =========================================================
         3. Panel Filter Data (Praktis & Terstruktur)
         ========================================================= */}
      <div className="rekap-filter-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
            <Calendar size={16} color="var(--primary)" />
            <span>Periode Data: <strong style={{ color: 'var(--primary)' }}>{periodLabel}</strong></span>
          </div>

          <button className="filter-reset-btn" onClick={handleReset} title="Kembali ke default Bulan Ini">
            <RotateCcw size={13} />
            Reset Filter
          </button>
        </div>

        <div className="rekap-controls-row">
          {/* 1. Periode Dropdown */}
          <select
            className="filter-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="THIS_MONTH">Bulan Ini ({thisMonthString})</option>
            <option value="LAST_MONTH">Bulan Lalu ({lastMonthString})</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                Bulan: {m}
              </option>
            ))}
            <option value="THIS_YEAR">Tahun Ini ({curYear})</option>
            <option value="ALL">Semua Periode</option>
          </select>

          {/* 2. Divisi Dropdown */}
          <select
            className="filter-select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">Semua Divisi ({departments.length})</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                Divisi: {d}
              </option>
            ))}
          </select>

          {/* 3. Status Dropdown */}
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="DECIDED">Selesai (Disetujui &amp; Ditolak)</option>
            <option value="APPROVED">Hanya yang Disetujui (ACC)</option>
            <option value="REJECTED">Hanya yang Ditolak</option>
            <option value="ALL">Semua Status (+ Menunggu)</option>
          </select>

          {/* 4. Cari Nama Karyawan */}
          <div className="filter-input-wrap">
            <Search size={15} className="filter-icon-left" />
            <input
              type="text"
              className="filter-input"
              placeholder="Cari nama atau ID karyawan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================
         4. Navigasi Tab Data
         ========================================================= */}
      <div className="rekap-tabs-bar">
        <div className="rekap-segmented">
          <button
            className={`rekap-tab-btn ${activeTab === 'karyawan' ? 'active' : ''}`}
            onClick={() => setActiveTab('karyawan')}
          >
            <Users size={15} />
            Rekap Saldo &amp; Lembur
            <span className="rekap-tab-count">{employeeList.length}</span>
          </button>

          <button
            className={`rekap-tab-btn ${activeTab === 'izin' ? 'active' : ''}`}
            onClick={() => setActiveTab('izin')}
          >
            <Calendar size={15} />
            Riwayat Izin &amp; Cuti
            <span className="rekap-tab-count">{filteredIzin.length}</span>
          </button>

          <button
            className={`rekap-tab-btn ${activeTab === 'lembur' ? 'active' : ''}`}
            onClick={() => setActiveTab('lembur')}
          >
            <Clock size={15} />
            Riwayat Lembur
            <span className="rekap-tab-count">{filteredLembur.length}</span>
          </button>
        </div>

        {/* Kontrol Tambahan Khusus Tab Karyawan */}
        {activeTab === 'karyawan' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Toggle Hanya yang Ada Pengajuan */}
            <button
              type="button"
              className={`preset-chip ${onlyActiveEmployees ? 'active' : ''}`}
              onClick={() => setOnlyActiveEmployees(!onlyActiveEmployees)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <UserCheck size={13} />
              {onlyActiveEmployees ? 'Hanya Karyawan Beraktivitas' : 'Tampilkan Semua Karyawan'}
            </button>

            {/* Urutan 2 Seksi: By Data dan By Time */}
            <div className="rekap-active-meta">
              <ArrowUpDown size={13} />
              <select
                className="rekap-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <optgroup label="Berdasarkan Data (Metrik)">
                  <option value="nama_asc">Nama Karyawan (A - Z)</option>
                  <option value="nama_desc">Nama Karyawan (Z - A)</option>
                  <option value="lembur_desc">Akumulasi Lembur Terbanyak</option>
                  <option value="sisa_cuti_asc">Sisa Cuti Tersedikit</option>
                  <option value="dept">Berdasarkan Divisi</option>
                </optgroup>
                <optgroup label="Berdasarkan Waktu (Kronologi)">
                  <option value="time_latest">Aktivitas / Pengajuan Terbaru</option>
                  <option value="time_oldest">Aktivitas / Pengajuan Terlama</option>
                  <option value="join_latest">Tanggal Bergabung Terbaru</option>
                </optgroup>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
         5. TAB 1: REKAP SALDO CUTI & LEMBUR KARYAWAN
         ========================================================= */}
      {activeTab === 'karyawan' && (
        <>
          {/* Desktop Table */}
          <div className="rekap-table-card">
            <div className="rekap-table-wrapper">
              <table className="rekap-table">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Divisi</th>
                    <th>Saldo Cuti Tahunan</th>
                    <th>Cuti Dipakai ({period === 'THIS_MONTH' ? 'Bulan Ini' : 'Periode Ini'})</th>
                    <th>Total Jam Lembur (ACC)</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                        Tidak ada data karyawan yang cocok dengan kriteria filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    employeeList.map((emp) => {
                      const initials = emp.nama_karyawan
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      const isZero = emp.sisaCuti === 0;
                      const isLow = emp.sisaCuti > 0 && emp.sisaCuti <= 3;
                      const shouldShowAction = emp.hasActivity || isZero;

                      return (
                        <tr key={emp.id_karyawan}>
                          <td>
                            <div className="table-emp-cell">
                              <div className="table-emp-avatar">{initials}</div>
                              <div className="table-emp-details">
                                <span className="table-emp-name">{emp.nama_karyawan}</span>
                                <span className="table-emp-id">#{emp.id_karyawan} · {emp.jabatan}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="dept-badge">
                              <Building2 size={12} />
                              {emp.departemen}
                            </span>
                          </td>
                          <td>
                            <span className={`balance-pill ${isZero ? 'danger' : isLow ? 'warning' : 'safe'}`}>
                              Sisa {emp.sisaCuti} dari {emp.jatahAwal} Hari
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: emp.cutiPeriodeIni > 0 ? 'var(--primary)' : 'inherit' }}>
                              {emp.cutiPeriodeIni} Hari
                            </strong>
                            {emp.izinLainPeriodeIni > 0 && (
                              <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>
                                (+{emp.izinLainPeriodeIni} izin tanpa potong cuti)
                              </span>
                            )}
                          </td>
                          <td>
                            <strong style={{ color: emp.jamLemburAcc > 0 ? '#059669' : '#64748b' }}>
                              {emp.jamLemburAcc} Jam
                            </strong>
                            <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>
                              {emp.sesiLembur} sesi lembur
                            </span>
                          </td>
                          <td>
                            {shouldShowAction ? (
                              <button
                                className="btn-table-action"
                                onClick={() => {
                                  setDrilldownEmp(emp);
                                  setDrilldownSubTab('izin');
                                }}
                                title="Lihat rincian riwayat izin dan lembur"
                              >
                                <Eye size={12} />
                                Lihat Rincian
                              </button>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 14, userSelect: 'none' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="rekap-mobile-cards">
            {employeeList.length === 0 ? (
              <div className="empty">Tidak ada data karyawan yang cocok dengan kriteria filter.</div>
            ) : (
              employeeList.map((emp) => {
                const initials = emp.nama_karyawan
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const isZero = emp.sisaCuti === 0;
                const isLow = emp.sisaCuti > 0 && emp.sisaCuti <= 3;
                const shouldShowAction = emp.hasActivity || isZero;

                return (
                  <div className="rekap-card-item" key={emp.id_karyawan}>
                    <div className="rekap-card-header">
                      <div className="rekap-card-emp">
                        <div className="table-emp-avatar">{initials}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{emp.nama_karyawan}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                            #{emp.id_karyawan} · {emp.departemen}
                          </div>
                        </div>
                      </div>
                      <span className={`balance-pill ${isZero ? 'danger' : isLow ? 'warning' : 'safe'}`}>
                        Sisa {emp.sisaCuti} Hari
                      </span>
                    </div>

                    <div className="rekap-card-stats-grid">
                      <div className="rekap-card-stat">
                        <span className="rekap-card-stat-label">Cuti Dipakai</span>
                        <span className="rekap-card-stat-val">{emp.cutiPeriodeIni} Hari</span>
                      </div>
                      <div className="rekap-card-stat">
                        <span className="rekap-card-stat-label">Lembur Disetujui</span>
                        <span className="rekap-card-stat-val" style={{ color: '#059669' }}>
                          {emp.jamLemburAcc} Jam
                        </span>
                      </div>
                    </div>

                    <div className="rekap-card-footer">
                      <span>{emp.totalPengajuan > 0 ? `${emp.totalPengajuan} Pengajuan` : 'Tidak ada pengajuan'}</span>
                      {shouldShowAction ? (
                        <button
                          className="btn-table-action"
                          onClick={() => {
                            setDrilldownEmp(emp);
                            setDrilldownSubTab('izin');
                          }}
                        >
                          <Eye size={12} />
                          Lihat Rincian
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* =========================================================
         6. TAB 2: RIWAYAT IZIN & CUTI
         ========================================================= */}
      {activeTab === 'izin' && (
        <>
          <div className="rekap-table-card">
            <div className="rekap-table-wrapper">
              <table className="rekap-table">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Divisi</th>
                    <th>Tanggal Izin</th>
                    <th>Durasi</th>
                    <th>Kategori</th>
                    <th>Ketentuan Saldo Cuti</th>
                    <th>Alasan Pengajuan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIzin.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                        Tidak ada riwayat izin pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredIzin.map((i) => {
                      const emp = master.find((m) => m.id_karyawan === i.id_karyawan);
                      const potong = getHariPotongCuti(i);
                      const durasiHari = daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir);

                      return (
                        <tr key={i.id}>
                          <td>
                            <strong>{getNama(i, master)}</strong>
                            <span style={{ display: 'block', fontSize: 11, color: '#64748b' }}>
                              #{i.id_karyawan}
                            </span>
                          </td>
                          <td>
                            <span className="dept-badge">{emp?.departemen || 'Umum'}</span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 700 }}>
                              {formatRentangTanggal(i.tanggal_izin_mulai, i.tanggal_izin_akhir)}
                            </span>
                          </td>
                          <td>
                            <strong>{durasiHari} Hari</strong>
                          </td>
                          <td>
                            <span className="type-chip blue">{i.kategori_izin || '-'}</span>
                          </td>
                          <td>
                            {potong > 0 ? (
                              <span className="potong-chip ya">Potong {potong} Hari Cuti</span>
                            ) : (
                              <span className="potong-chip tidak">Tanpa Potong Cuti</span>
                            )}
                          </td>
                          <td style={{ maxWidth: 220, fontSize: 12, color: 'var(--text-muted)' }}>
                            {i.alasan || '-'}
                          </td>
                          <td>
                            <StatusBadge status={i.status} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="rekap-mobile-cards">
            {filteredIzin.length === 0 ? (
              <div className="empty">Tidak ada riwayat izin pada periode ini.</div>
            ) : (
              filteredIzin.map((i) => {
                const emp = master.find((m) => m.id_karyawan === i.id_karyawan);
                const potong = getHariPotongCuti(i);
                const durasiHari = daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir);

                return (
                  <div className="rekap-card-item" key={i.id}>
                    <div className="rekap-card-header">
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{getNama(i, master)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                          #{i.id_karyawan} · {emp?.departemen || 'Umum'}
                        </div>
                      </div>
                      <StatusBadge status={i.status} />
                    </div>

                    <div className="rekap-card-stats-grid">
                      <div className="rekap-card-stat">
                        <span className="rekap-card-stat-label">Tanggal Izin</span>
                        <span className="rekap-card-stat-val" style={{ fontSize: 12 }}>
                          {formatRentangTanggal(i.tanggal_izin_mulai, i.tanggal_izin_akhir)}
                        </span>
                      </div>
                      <div className="rekap-card-stat">
                        <span className="rekap-card-stat-label">Durasi &amp; Kategori</span>
                        <span className="rekap-card-stat-val" style={{ fontSize: 12 }}>
                          {durasiHari} Hari ({i.kategori_izin})
                        </span>
                      </div>
                    </div>

                    <div className="rekap-card-footer">
                      {potong > 0 ? (
                        <span className="potong-chip ya">Potong {potong} Hari</span>
                      ) : (
                        <span className="potong-chip tidak">Tanpa Potong</span>
                      )}
                      <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {i.alasan || '-'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* =========================================================
         7. TAB 3: RIWAYAT LEMBUR
         ========================================================= */}
      {activeTab === 'lembur' && (
        <>
          <div className="rekap-table-card">
            <div className="rekap-table-wrapper">
              <table className="rekap-table">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Divisi</th>
                    <th>Tanggal Lembur</th>
                    <th>Jam Mulai - Selesai</th>
                    <th>Durasi Lembur</th>
                    <th>Alasan / Pekerjaan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLembur.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                        Tidak ada riwayat lembur pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredLembur.map((l) => {
                      const emp = master.find((m) => m.id_karyawan === l.id_karyawan);
                      return (
                        <tr key={l.id}>
                          <td>
                            <strong>{getNama(l, master)}</strong>
                            <span style={{ display: 'block', fontSize: 11, color: '#64748b' }}>
                              #{l.id_karyawan}
                            </span>
                          </td>
                          <td>
                            <span className="dept-badge">{emp?.departemen || 'Umum'}</span>
                          </td>
                          <td>
                            <strong>{formatTanggal(l.tanggal_lembur, 'long')}</strong>
                          </td>
                          <td>
                            <span className="type-chip indigo">
                              {formatRentangJam(l.jam_awal, l.jam_selesai)}
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--primary)' }}>
                              {parseFloat(l.durasi) || 0} Jam
                            </strong>
                            <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>
                              ({formatTeksJam(l.durasi)})
                            </span>
                          </td>
                          <td style={{ maxWidth: 240, fontSize: 12, color: 'var(--text-muted)' }}>
                            {l.alasan || '-'}
                          </td>
                          <td>
                            <StatusBadge status={l.status} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="rekap-mobile-cards">
            {filteredLembur.length === 0 ? (
              <div className="empty">Tidak ada riwayat lembur pada periode ini.</div>
            ) : (
              filteredLembur.map((l) => {
                const emp = master.find((m) => m.id_karyawan === l.id_karyawan);
                return (
                  <div className="rekap-card-item" key={l.id}>
                    <div className="rekap-card-header">
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{getNama(l, master)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                          #{l.id_karyawan} · {emp?.departemen || 'Umum'}
                        </div>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>

                    <div className="rekap-card-stats-grid">
                      <div className="rekap-card-stat">
                        <span className="rekap-card-stat-label">Tanggal &amp; Waktu</span>
                        <span className="rekap-card-stat-val" style={{ fontSize: 12 }}>
                          {formatTanggal(l.tanggal_lembur)} ({formatRentangJam(l.jam_awal, l.jam_selesai)})
                        </span>
                      </div>
                      <div className="rekap-card-stat">
                        <span className="rekap-card-stat-label">Durasi Terhitung</span>
                        <span className="rekap-card-stat-val" style={{ fontSize: 12, color: 'var(--primary)' }}>
                          {formatTeksJam(l.durasi)}
                        </span>
                      </div>
                    </div>

                    <div className="rekap-card-footer">
                      <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.alasan || '-'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* =========================================================
         8. MODAL DETAIL RIWAYAT KARYAWAN (Rapi & Profesional)
         ========================================================= */}
      {drilldownEmp && (
        <Modal
          maxWidth="720px"
          onClose={() => setDrilldownEmp(null)}
          className="drilldown-modal-box"
        >
          {/* Header Profil */}
          <div className="drilldown-hero">
            <div className="drilldown-hero-left">
              <div className="drilldown-avatar">
                {drilldownEmp.nama_karyawan
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="drilldown-hero-title">
                <h4>{drilldownEmp.nama_karyawan}</h4>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  #{drilldownEmp.id_karyawan} · Divisi {drilldownEmp.departemen} · {drilldownEmp.jabatan}
                </div>
              </div>
            </div>

            {/* Kotak Saldo Cuti */}
            <div style={{ background: '#ffffff', padding: '8px 14px', borderRadius: 12, border: '1px solid #ddd6fe', textAlign: 'right' }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block' }}>
                Sisa Saldo Cuti Tahunan
              </span>
              <strong style={{ fontSize: 16, color: 'var(--primary)' }}>
                {drilldownEmp.sisaCuti} Hari
              </strong>
              <span style={{ fontSize: 11, color: '#64748b' }}> / {drilldownEmp.jatahAwal} Hari</span>
            </div>
          </div>

          {/* Ringkasan pada Periode Aktif */}
          <div className="drilldown-stats-grid">
            <div className="drilldown-stat-card">
              <span className="drilldown-stat-label">Cuti Terpakai ({periodLabel})</span>
              <span className="drilldown-stat-val" style={{ color: 'var(--primary)' }}>
                {drilldownEmp.cutiPeriodeIni} Hari
              </span>
            </div>
            <div className="drilldown-stat-card">
              <span className="drilldown-stat-label">Lembur Disetujui</span>
              <span className="drilldown-stat-val" style={{ color: '#059669' }}>
                {drilldownEmp.jamLemburAcc} Jam
              </span>
            </div>
            <div className="drilldown-stat-card">
              <span className="drilldown-stat-label">Izin Non-Potong Cuti</span>
              <span className="drilldown-stat-val">{drilldownEmp.izinLainPeriodeIni} Hari</span>
            </div>
          </div>

          {/* Tab Sub Riwayat */}
          <div className="rekap-segmented" style={{ marginBottom: 14 }}>
            <button
              className={`rekap-tab-btn ${drilldownSubTab === 'izin' ? 'active' : ''}`}
              onClick={() => setDrilldownSubTab('izin')}
            >
              <Calendar size={13} />
              Riwayat Izin ({drilldownData.izin.length})
            </button>
            <button
              className={`rekap-tab-btn ${drilldownSubTab === 'lembur' ? 'active' : ''}`}
              onClick={() => setDrilldownSubTab('lembur')}
            >
              <Clock size={13} />
              Riwayat Lembur ({drilldownData.lembur.length})
            </button>
          </div>

          {/* Isi Riwayat */}
          <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {drilldownSubTab === 'izin' ? (
              drilldownData.izin.length === 0 ? (
                <div className="empty">Tidak ada riwayat izin untuk karyawan ini pada periode aktif.</div>
              ) : (
                drilldownData.izin.map((i) => {
                  const potong = getHariPotongCuti(i);
                  const durasi = daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir);
                  return (
                    <div className="rekap-card-item" key={i.id} style={{ padding: 12 }}>
                      <div className="rekap-card-header">
                        <div>
                          <strong>{formatRentangTanggal(i.tanggal_izin_mulai, i.tanggal_izin_akhir, 'long')}</strong>
                          <span style={{ display: 'block', fontSize: 11, color: '#64748b' }}>
                            Durasi: {durasi} Hari · Kategori: {i.kategori_izin}
                          </span>
                        </div>
                        <StatusBadge status={i.status} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', background: '#f8fafc', padding: '6px 10px', borderRadius: 8 }}>
                        Alasan: {i.alasan || '-'}
                      </div>
                      <div style={{ fontSize: 11, color: potong > 0 ? 'var(--primary)' : '#64748b', fontWeight: 600 }}>
                        {potong > 0 ? `Memotong ${potong} Hari Saldo Cuti` : 'Tanpa Potong Cuti'}
                      </div>
                    </div>
                  );
                })
              )
            ) : drilldownData.lembur.length === 0 ? (
              <div className="empty">Tidak ada riwayat lembur untuk karyawan ini pada periode aktif.</div>
            ) : (
              drilldownData.lembur.map((l) => (
                <div className="rekap-card-item" key={l.id} style={{ padding: 12 }}>
                  <div className="rekap-card-header">
                    <div>
                      <strong>{formatTanggal(l.tanggal_lembur, 'long')}</strong>
                      <span style={{ display: 'block', fontSize: 11, color: '#64748b' }}>
                        Waktu: {formatRentangJam(l.jam_awal, l.jam_selesai)} · Durasi: {formatTeksJam(l.durasi)} ({parseFloat(l.durasi) || 0} Jam)
                      </span>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', background: '#f8fafc', padding: '6px 10px', borderRadius: 8 }}>
                    Pekerjaan: {l.alasan || '-'}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Tombol Aksi Bawah Modal */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              className="btn-export-sub"
              onClick={() => downloadRiwayatIndividu(drilldownEmp)}
            >
              <Download size={13} />
              Unduh Riwayat ({drilldownEmp.nama_karyawan})
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setDrilldownEmp(null)}
            >
              Tutup
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
