import { useMemo, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Search,
  Calendar,
  Clock,
  Users,
  Building2,
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

  // Current date markers (Memoized agar compiler React stabil)
  const {
    now,
    curYear,
    curMonth,
    lastMonthNum,
    lastMonthYear,
    lastMonthString,
    thisMonthString,
    todayIso,
    firstDayOfMonthIso,
  } = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const lmNum = m === 0 ? 11 : m - 1;
    const lmYear = m === 0 ? y - 1 : y;
    return {
      now: d,
      curYear: y,
      curMonth: m,
      lastMonthNum: lmNum,
      lastMonthYear: lmYear,
      lastMonthString: `${MONTH_NAMES[lmNum]} ${lmYear}`,
      thisMonthString: `${MONTH_NAMES[m]} ${y}`,
      todayIso: d.toISOString().slice(0, 10),
      firstDayOfMonthIso: new Date(y, m, 1).toISOString().slice(0, 10),
    };
  }, []);

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

  // Modal Ekspor Excel (Opsi 2: Pilihan Bulan / Custom Rentang Tanggal)
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState('CURRENT'); // 'CURRENT' | 'MONTH' | 'CUSTOM' | 'ALL'
  const [exportMonth, setExportMonth] = useState('THIS_MONTH');
  const [exportDept, setExportDept] = useState('ALL');
  const [exportStartDate, setExportStartDate] = useState(firstDayOfMonthIso);
  const [exportEndDate, setExportEndDate] = useState(todayIso);

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

  // Analisis Aktivitas Departemen untuk Diagram Visual
  const deptStats = useMemo(() => {
    const counts = {};
    departments.forEach((d) => {
      counts[d] = { total: 0, lembur: 0, izin: 0 };
    });

    filteredIzin.forEach((i) => {
      const emp = master.find((m) => m.id_karyawan === i.id_karyawan);
      const d = emp?.departemen || 'Umum';
      if (!counts[d]) counts[d] = { total: 0, lembur: 0, izin: 0 };
      counts[d].total += 1;
      counts[d].izin += 1;
    });

    filteredLembur.forEach((l) => {
      const emp = master.find((m) => m.id_karyawan === l.id_karyawan);
      const d = emp?.departemen || 'Umum';
      if (!counts[d]) counts[d] = { total: 0, lembur: 0, izin: 0 };
      counts[d].total += 1;
      counts[d].lembur += 1;
    });

    const totalAll = filteredIzin.length + filteredLembur.length;
    const list = Object.entries(counts)
      .filter(([, data]) => data.total > 0)
      .map(([name, data]) => ({
        name,
        ...data,
        percent: totalAll > 0 ? Math.round((data.total / totalAll) * 100) : 0,
      }));

    return list.sort((a, b) => b.total - a.total);
  }, [departments, filteredIzin, filteredLembur, master]);

  const participationPercent = useMemo(() => {
    return master.length > 0 ? Math.round((summaryKPI.activeCount / master.length) * 100) : 0;
  }, [summaryKPI.activeCount, master.length]);

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
        const jab = (emp.jabatan || '').toLowerCase();
        if (!nm.includes(q) && !idK.includes(q) && !dpt.includes(q) && !jab.includes(q)) return false;
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

  // Urutkan Riwayat Izin
  const sortedIzin = useMemo(() => {
    const list = [...filteredIzin];
    return list.sort((a, b) => {
      if (sortBy === 'nama_asc') return getNama(a, master).localeCompare(getNama(b, master));
      if (sortBy === 'nama_desc') return getNama(b, master).localeCompare(getNama(a, master));
      if (sortBy === 'time_oldest') return String(a.tanggal_izin_mulai || '').localeCompare(String(b.tanggal_izin_mulai || ''));
      return String(b.tanggal_izin_mulai || '').localeCompare(String(a.tanggal_izin_mulai || ''));
    });
  }, [filteredIzin, master, sortBy]);

  // Urutkan Riwayat Lembur
  const sortedLembur = useMemo(() => {
    const list = [...filteredLembur];
    return list.sort((a, b) => {
      if (sortBy === 'nama_asc') return getNama(a, master).localeCompare(getNama(b, master));
      if (sortBy === 'nama_desc') return getNama(b, master).localeCompare(getNama(a, master));
      if (sortBy === 'lembur_desc') return (parseFloat(b.durasi) || 0) - (parseFloat(a.durasi) || 0);
      if (sortBy === 'time_oldest') return String(a.tanggal_lembur || '').localeCompare(String(b.tanggal_lembur || ''));
      return String(b.tanggal_lembur || '').localeCompare(String(a.tanggal_lembur || ''));
    });
  }, [filteredLembur, master, sortBy]);

  // --- 8. Preview Data untuk Ekspor Excel (Opsi 2) ---
  const exportPreviewData = useMemo(() => {
    // Filter Izin
    const exportIzin = izin.filter((x) => {
      const st = normalizeStatus(x.status);
      if (st === 'PENDING') return false;

      const emp = master.find((m) => m.id_karyawan === x.id_karyawan);
      if (exportDept !== 'ALL' && (emp?.departemen || 'Umum') !== exportDept) return false;

      if (exportScope === 'CURRENT') {
        return matchPeriod(x.tanggal_izin_mulai);
      }
      if (exportScope === 'ALL') {
        return true;
      }
      if (exportScope === 'MONTH') {
        if (exportMonth === 'THIS_MONTH') {
          const parts = String(x.tanggal_izin_mulai || '').split('-');
          return parts.length >= 2 && parseInt(parts[0], 10) === curYear && parseInt(parts[1], 10) - 1 === curMonth;
        }
        if (exportMonth === 'LAST_MONTH') {
          const parts = String(x.tanggal_izin_mulai || '').split('-');
          return parts.length >= 2 && parseInt(parts[0], 10) === lastMonthYear && parseInt(parts[1], 10) - 1 === lastMonthNum;
        }
        if (exportMonth === 'THIS_YEAR') {
          const parts = String(x.tanggal_izin_mulai || '').split('-');
          return parts.length >= 1 && parseInt(parts[0], 10) === curYear;
        }
        return getMonthStringFromDate(x.tanggal_izin_mulai) === exportMonth;
      }
      if (exportScope === 'CUSTOM') {
        const d = String(x.tanggal_izin_mulai || '');
        if (!d) return false;
        if (exportStartDate && d < exportStartDate) return false;
        if (exportEndDate && d > exportEndDate) return false;
        return true;
      }
      return true;
    });

    // Filter Lembur
    const exportLembur = lembur.filter((x) => {
      const st = normalizeStatus(x.status);
      if (st === 'PENDING') return false;

      const emp = master.find((m) => m.id_karyawan === x.id_karyawan);
      if (exportDept !== 'ALL' && (emp?.departemen || 'Umum') !== exportDept) return false;

      if (exportScope === 'CURRENT') {
        return matchPeriod(x.tanggal_lembur, x.bulan_lembur);
      }
      if (exportScope === 'ALL') {
        return true;
      }
      if (exportScope === 'MONTH') {
        if (x.bulan_lembur && x.bulan_lembur.trim() === exportMonth) return true;
        if (exportMonth === 'THIS_MONTH') {
          const parts = String(x.tanggal_lembur || '').split('-');
          return parts.length >= 2 && parseInt(parts[0], 10) === curYear && parseInt(parts[1], 10) - 1 === curMonth;
        }
        if (exportMonth === 'LAST_MONTH') {
          const parts = String(x.tanggal_lembur || '').split('-');
          return parts.length >= 2 && parseInt(parts[0], 10) === lastMonthYear && parseInt(parts[1], 10) - 1 === lastMonthNum;
        }
        if (exportMonth === 'THIS_YEAR') {
          const parts = String(x.tanggal_lembur || '').split('-');
          return parts.length >= 1 && parseInt(parts[0], 10) === curYear;
        }
        return getMonthStringFromDate(x.tanggal_lembur) === exportMonth;
      }
      if (exportScope === 'CUSTOM') {
        const d = String(x.tanggal_lembur || '');
        if (!d) return false;
        if (exportStartDate && d < exportStartDate) return false;
        if (exportEndDate && d > exportEndDate) return false;
        return true;
      }
      return true;
    });

    // Karyawan sesuai filter departemen
    const exportEmps = master.filter((emp) => {
      if (exportDept !== 'ALL' && (emp.departemen || 'Umum') !== exportDept) return false;
      return true;
    });

    return {
      izinList: exportIzin,
      lemburList: exportLembur,
      empCount: exportEmps.length,
      emps: exportEmps,
    };
  }, [
    izin,
    lembur,
    master,
    exportScope,
    exportMonth,
    exportStartDate,
    exportEndDate,
    exportDept,
    curYear,
    curMonth,
    lastMonthYear,
    lastMonthNum,
    matchPeriod,
  ]);

  // Eksekusi Download Laporan Excel 3 Sheet
  const handleExecuteExport = () => {
    const { izinList, lemburList, emps } = exportPreviewData;

    if (!emps.length && !izinList.length && !lemburList.length) {
      return notify('Tidak ada data yang ditemukan untuk kriteria ekspor ini.');
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Rekap Karyawan untuk periode ekspor ini
    const annualUsageMap = {};
    izin.forEach((i) => {
      if (normalizeStatus(i.status) === 'APPROVED' && i.id_karyawan) {
        const d = String(i.tanggal_izin_mulai || '');
        if (d.startsWith(String(curYear))) {
          annualUsageMap[i.id_karyawan] = (annualUsageMap[i.id_karyawan] || 0) + getHariPotongCuti(i);
        }
      }
    });

    const sheet1Data = emps.map((emp, idx) => {
      const empIzin = izinList.filter((i) => i.id_karyawan === emp.id_karyawan);
      const empLembur = lemburList.filter((l) => l.id_karyawan === emp.id_karyawan);

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

      return {
        No: idx + 1,
        'ID Karyawan': emp.id_karyawan,
        'Nama Karyawan': emp.nama_karyawan,
        Divisi: emp.departemen || 'Umum',
        Jabatan: emp.jabatan || 'Karyawan',
        'Jatah Cuti Awal': jatahAwal,
        'Cuti Terpakai (Periode Ini)': cutiPeriodeIni,
        'Sisa Saldo Cuti (Hari)': sisaCuti,
        'Izin Non-Potong (Hari)': izinLainPeriodeIni,
        'Total Lembur Disetujui (Jam)': Math.round(jamLemburAcc * 10) / 10,
        'Frekuensi Lembur': empLembur.length,
        'Frekuensi Izin': empIzin.length,
      };
    });

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
    const sheet2Data = izinList.map((i, idx) => {
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
    const sheet3Data = lemburList.map((l, idx) => {
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

    // Penamaan file yang rapi
    let scopeName = 'Laporan_HR_Arasa';
    if (exportScope === 'CURRENT') {
      scopeName += `_${periodLabel.replace(/[\s/\\?%*:|"<>]+/g, '_')}`;
    } else if (exportScope === 'MONTH') {
      const mLabel =
        exportMonth === 'THIS_MONTH'
          ? thisMonthString
          : exportMonth === 'LAST_MONTH'
          ? lastMonthString
          : exportMonth === 'THIS_YEAR'
          ? String(curYear)
          : exportMonth;
      scopeName += `_${mLabel.replace(/[\s/\\?%*:|"<>]+/g, '_')}`;
    } else if (exportScope === 'CUSTOM') {
      scopeName += `_${exportStartDate || 'awal'}_sd_${exportEndDate || 'akhir'}`;
    } else {
      scopeName += '_Semua_Periode';
    }
    if (exportDept !== 'ALL') {
      scopeName += `_Divisi_${exportDept.replace(/[\s/\\?%*:|"<>]+/g, '_')}`;
    }
    scopeName += '.xlsx';

    XLSX.writeFile(wb, scopeName);
    setShowExportModal(false);
    notify('Laporan Excel berhasil diunduh.');
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
         1. Header Eksekutif & Unduh Excel
         ========================================================= */}
      <div className="rekap-header-card">
        <div className="rekap-title-wrap">
          <div className="rekap-title-icon">
            <FileSpreadsheet size={26} />
          </div>
          <div className="rekap-title-text">
            <h1>Rekap SDM</h1>
            <p>Laporan cuti dan lembur karyawan.</p>
          </div>
        </div>

        <div className="rekap-header-actions">
          <div className="rekap-date-widget" title="Tanggal Aktual Sistem">
            <div className="rekap-date-icon-circle">
              <Calendar size={15} />
            </div>
            <div className="rekap-date-text-group">
              <span className="rekap-date-tag">Hari Ini</span>
              <span className="rekap-date-value">{formatTanggal(now, 'full')}</span>
            </div>
          </div>
          <button
            className="btn-export-main"
            onClick={() => setShowExportModal(true)}
            title="Pilih periode dan unduh rekapitulasi Excel 3 Sheet lengkap"
          >
            <Download size={16} />
            Unduh Rekapitulasi Excel
          </button>
        </div>
      </div>

      {/* =========================================================
         2. Ringkasan & Diagram Visual SDM (Bukan 4 Card Segaris)
         ========================================================= */}
      <div className="rekap-overview-grid">
        {/* Kolom Kiri: 2 Kartu Metrik Utama */}
        <div className="rekap-metrics-col">
          {/* Kartu 1: Akumulasi Lembur */}
          <div className="rekap-metric-box">
            <div className="rekap-metric-header">
              <div className="rekap-metric-icon indigo">
                <Clock size={20} />
              </div>
              <span className="rekap-metric-tag">Total Lembur Disetujui</span>
            </div>
            <div>
              <div className="rekap-metric-val">
                {summaryKPI.jamLemburApproved} <span className="rekap-metric-unit">Jam</span>
              </div>
              <div className="rekap-metric-sub">{summaryKPI.sesiLembur} sesi lembur tercatat pada periode ini</div>
            </div>
          </div>

          {/* Kartu 2: Penggunaan Cuti & Izin */}
          <div className="rekap-metric-box">
            <div className="rekap-metric-header">
              <div className="rekap-metric-icon emerald">
                <Calendar size={20} />
              </div>
              <span className="rekap-metric-tag">Penggunaan Cuti &amp; Izin</span>
            </div>
            <div>
              <div className="rekap-metric-val">
                {summaryKPI.hariCutiDipotong} <span className="rekap-metric-unit">Hari Cuti</span>
              </div>
              <div className="rekap-metric-sub">
                {summaryKPI.hariIzinLain > 0
                  ? `+${summaryKPI.hariIzinLain} hari izin tanpa potong cuti`
                  : 'Memotong saldo jatah tahunan'}
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Diagram Distribusi Aktivitas & Partisipasi Tim */}
        <div className="rekap-chart-card">
          <div className="rekap-chart-header">
            <div>
              <h4 className="rekap-chart-title">Distribusi Aktivitas Departemen</h4>
              <p className="rekap-chart-subtitle">Proporsi pengajuan izin &amp; lembur antar divisi</p>
            </div>
            <div className="rekap-participation-badge">
              <span>{summaryKPI.activeCount}/{master.length} Tim Aktif</span>
              <strong style={{ color: 'var(--primary)' }}>({participationPercent}%)</strong>
            </div>
          </div>

          {/* Progress Bar Visual per Divisi */}
          <div className="rekap-dept-bars">
            {deptStats.length === 0 || (filteredIzin.length === 0 && filteredLembur.length === 0) ? (
              <div style={{ color: '#94a3b8', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
                Belum ada data aktivitas pada periode ini.
              </div>
            ) : (
              deptStats.slice(0, 3).map((d) => (
                <div key={d.name} className="rekap-dept-row">
                  <div className="rekap-dept-info">
                    <span className="rekap-dept-name">{d.name}</span>
                    <span className="rekap-dept-detail">
                      {d.total} pengajuan ({d.lembur} lembur · {d.izin} izin)
                    </span>
                  </div>
                  <div className="rekap-bar-track">
                    <div
                      className="rekap-bar-fill"
                      style={{ width: `${Math.max(d.percent, 4)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* =========================================================
         3. Navigasi Tampilan (Semua Data, Izin, Lembur)
         ========================================================= */}
      <div className="rekap-tabs-bar">
        <div className="rekap-segmented">
          <button
            className={`rekap-tab-btn ${activeTab === 'karyawan' ? 'active' : ''}`}
            onClick={() => setActiveTab('karyawan')}
          >
            <Users size={15} />
            Semua Data
            <span className="rekap-tab-count">{employeeList.length}</span>
          </button>

          <button
            className={`rekap-tab-btn ${activeTab === 'izin' ? 'active' : ''}`}
            onClick={() => setActiveTab('izin')}
          >
            <Calendar size={15} />
            Izin
            <span className="rekap-tab-count">{filteredIzin.length}</span>
          </button>

          <button
            className={`rekap-tab-btn ${activeTab === 'lembur' ? 'active' : ''}`}
            onClick={() => setActiveTab('lembur')}
          >
            <Clock size={15} />
            Lembur
            <span className="rekap-tab-count">{filteredLembur.length}</span>
          </button>
        </div>
      </div>

      {/* =========================================================
         4. Toolbar Tabel Terpadu (Pencarian Prominen & Dropdown Sejajar)
         ========================================================= */}
      <div className="rekap-toolbar-card">
        {/* Baris 1: Pencarian Penuh (Lega & Prominen) */}
        <div className="rekap-search-field">
          <Search size={16} className="filter-icon-left" />
          <input
            type="text"
            className="rekap-search-input"
            placeholder="Cari nama karyawan, ID/NIK, jabatan, atau divisi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="rekap-search-clear"
              onClick={() => setSearch('')}
              title="Hapus pencarian"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Baris 2: Controls Horisontal (Filter & Sort Sejajar) */}
        <div className="rekap-toolbar-row">
          <div className="rekap-filters-strip">
            {/* Dropdown Periode */}
            <select
              className="filter-select"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              title="Pilih Periode Waktu"
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

            {/* Dropdown Divisi */}
            <select
              className="filter-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              title="Filter Divisi / Departemen"
            >
              <option value="ALL">Semua Divisi ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  Divisi: {d}
                </option>
              ))}
            </select>

            {/* Dropdown Status */}
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              title="Filter Status Pengajuan"
            >
              <option value="DECIDED">Status: Selesai</option>
              <option value="APPROVED">Status: Disetujui (ACC)</option>
              <option value="REJECTED">Status: Ditolak</option>
              <option value="ALL">Status: Semua</option>
            </select>

            {/* Dropdown Pengurutan (Sort) - Simple & Sleek (2 Seksi) */}
            <select
              className="filter-select filter-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              title="Urutkan Tampilan Data"
            >
              <optgroup label="Berdasarkan Data (Metrik)">
                <option value="nama_asc">Urutkan: Nama (A - Z)</option>
                <option value="nama_desc">Urutkan: Nama (Z - A)</option>
                <option value="lembur_desc">Urutkan: Lembur Terbanyak</option>
                <option value="dept">Urutkan: Divisi</option>
              </optgroup>
              <optgroup label="Berdasarkan Waktu (Kronologi)">
                <option value="time_latest">Urutkan: Aktivitas Terbaru</option>
                <option value="time_oldest">Urutkan: Aktivitas Terlama</option>
                <option value="join_latest">Urutkan: Bergabung Terbaru</option>
              </optgroup>
            </select>
          </div>

          {/* Opsi Tampilan & Tombol Reset */}
          <div className="rekap-actions-strip">
            {activeTab === 'karyawan' && (
              <button
                type="button"
                className={`preset-chip ${onlyActiveEmployees ? 'active' : ''}`}
                onClick={() => setOnlyActiveEmployees(!onlyActiveEmployees)}
                title="Tampilkan hanya karyawan yang memiliki riwayat izin atau lembur"
              >
                <UserCheck size={14} />
                {onlyActiveEmployees ? 'Hanya Beraktivitas' : 'Semua Karyawan'}
              </button>
            )}

            <button
              className="filter-reset-btn"
              onClick={handleReset}
              title="Kembalikan semua filter dan pengurutan ke kondisi default"
            >
              <RotateCcw size={13} />
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
         5. TAB 1: REKAP KARYAWAN (CUTI & LEMBUR)
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
                    <th>Cuti Dipakai ({period === 'THIS_MONTH' ? 'Bulan Ini' : 'Periode Ini'})</th>
                    <th>Total Jam Lembur (ACC)</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
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

                      const shouldShowAction = emp.hasActivity;

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

                const shouldShowAction = emp.hasActivity;

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
                  {sortedIzin.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                        Tidak ada riwayat izin pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    sortedIzin.map((i) => {
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
            {sortedIzin.length === 0 ? (
              <div className="empty">Tidak ada riwayat izin pada periode ini.</div>
            ) : (
              sortedIzin.map((i) => {
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
                  {sortedLembur.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                        Tidak ada riwayat lembur pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    sortedLembur.map((l) => {
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
            {sortedLembur.length === 0 ? (
              <div className="empty">Tidak ada riwayat lembur pada periode ini.</div>
            ) : (
              sortedLembur.map((l) => {
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

      {/* =========================================================
         9. MODAL EKSPOR EXCEL (Opsi 2: Fleksibel Bulan & Custom Rentang)
         ========================================================= */}
      {showExportModal && (
        <Modal
          maxWidth="560px"
          onClose={() => setShowExportModal(false)}
          className="export-modal-box"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div className="rekap-title-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-main)' }}>
                Unduh Laporan Excel SDM
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                Pilih periode waktu data yang ingin disertakan dalam berkas 3-sheet.
              </p>
            </div>
          </div>

          {/* Pilihan Lingkup Waktu (Scope) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
              Pilihan Periode Laporan:
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                className={`export-scope-btn ${exportScope === 'CURRENT' ? 'active' : ''}`}
                onClick={() => setExportScope('CURRENT')}
              >
                <span style={{ fontWeight: 700, fontSize: 12.5, display: 'block' }}>Sesuai Tampilan Aktif</span>
                <span style={{ fontSize: 11, opacity: 0.8, color: 'var(--text-muted)' }}>({periodLabel})</span>
              </button>

              <button
                type="button"
                className={`export-scope-btn ${exportScope === 'MONTH' ? 'active' : ''}`}
                onClick={() => setExportScope('MONTH')}
              >
                <span style={{ fontWeight: 700, fontSize: 12.5, display: 'block' }}>Pilih Bulan Tertentu</span>
                <span style={{ fontSize: 11, opacity: 0.8, color: 'var(--text-muted)' }}>Pilih bulan apa saja</span>
              </button>

              <button
                type="button"
                className={`export-scope-btn ${exportScope === 'CUSTOM' ? 'active' : ''}`}
                onClick={() => setExportScope('CUSTOM')}
              >
                <span style={{ fontWeight: 700, fontSize: 12.5, display: 'block' }}>Rentang Tanggal Kustom</span>
                <span style={{ fontSize: 11, opacity: 0.8, color: 'var(--text-muted)' }}>Dari tgl - sampai tgl</span>
              </button>

              <button
                type="button"
                className={`export-scope-btn ${exportScope === 'ALL' ? 'active' : ''}`}
                onClick={() => setExportScope('ALL')}
              >
                <span style={{ fontWeight: 700, fontSize: 12.5, display: 'block' }}>Semua Periode</span>
                <span style={{ fontSize: 11, opacity: 0.8, color: 'var(--text-muted)' }}>Seluruh rekam data</span>
              </button>
            </div>
          </div>

          {/* Input Kondisional sesuai Scope: Pilih Bulan */}
          {exportScope === 'MONTH' && (
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-faint)', display: 'block', marginBottom: 6 }}>
                Pilih Bulan Laporan:
              </label>
              <select
                className="filter-select"
                style={{ background: '#ffffff' }}
                value={exportMonth}
                onChange={(e) => setExportMonth(e.target.value)}
              >
                <option value="THIS_MONTH">Bulan Ini ({thisMonthString})</option>
                <option value="LAST_MONTH">Bulan Lalu ({lastMonthString})</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    Bulan: {m}
                  </option>
                ))}
                <option value="THIS_YEAR">Tahun Ini ({curYear})</option>
              </select>
            </div>
          )}

          {/* Input Kondisional sesuai Scope: Custom Range */}
          {exportScope === 'CUSTOM' && (
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-faint)', display: 'block', marginBottom: 8 }}>
                Tentukan Rentang Tanggal (Cut-off):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Dari Tanggal:</span>
                  <input
                    type="date"
                    className="filter-input"
                    style={{ padding: '8px 10px', fontSize: 12, background: '#ffffff' }}
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Sampai Tanggal:</span>
                  <input
                    type="date"
                    className="filter-input"
                    style={{ padding: '8px 10px', fontSize: 12, background: '#ffffff' }}
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Filter Divisi */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
              Filter Divisi / Departemen:
            </label>
            <select
              className="filter-select"
              value={exportDept}
              onChange={(e) => setExportDept(e.target.value)}
            >
              <option value="ALL">Semua Divisi ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  Divisi: {d}
                </option>
              ))}
            </select>
          </div>

          {/* Kotak Ringkasan Preview Data yang Siap Diekspor */}
          <div style={{ background: '#ede9fe', padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 20 }}>
            <span>Siap disertakan:</span>
            <span>
              {exportPreviewData.empCount} Karyawan · {exportPreviewData.izinList.length} Izin · {exportPreviewData.lemburList.length} Lembur
            </span>
          </div>

          {/* Tombol Aksi Bawah */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowExportModal(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-export-main"
              onClick={handleExecuteExport}
              style={{ padding: '9px 18px' }}
            >
              <Download size={15} />
              Unduh Berkas Excel (.xlsx)
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
