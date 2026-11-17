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
  BarChart3,
  FileText,
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
  formatJam,
  formatRentangJam,
  formatDateTime,
} from '../lib/utils';

export default function Rekap() {
  const { izin, lembur, master } = useAppStore();
  const notify = useToast();

  // --- View & Filter State ---
  const [activeTab, setActiveTab] = useState('karyawan'); // 'karyawan' | 'izin' | 'lembur' | 'analitik'
  const [periodPreset, setPeriodPreset] = useState('ALL'); // 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'CUSTOM'
  const [customMonth, setCustomMonth] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL_DECIDED'); // 'ALL_DECIDED' | 'APPROVED' | 'REJECTED' | 'ALL'
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('nama_asc');

  // --- Drilldown Modal State ---
  const [drilldownEmp, setDrilldownEmp] = useState(null);
  const [drilldownSubTab, setDrilldownSubTab] = useState('izin');

  // Current date markers
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-indexed

  // --- 1. Available Months for Custom Dropdown ---
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

    // Make sure current month & year are always included
    MONTH_NAMES.forEach((m) => {
      set.add(`${m} ${curYear}`);
    });

    return Array.from(set).sort((a, b) => {
      const [mA, yA] = a.split(' ');
      const [mB, yB] = b.split(' ');
      if (yA !== yB) return parseInt(yB || 0, 10) - parseInt(yA || 0, 10);
      return MONTH_NAMES.indexOf(mB) - MONTH_NAMES.indexOf(mA);
    });
  }, [izin, lembur, curYear]);

  // --- 2. Available Departments ---
  const departments = useMemo(() => {
    const set = new Set();
    master.forEach((m) => {
      if (m.departemen && m.departemen.trim() !== '') {
        set.add(m.departemen.trim());
      }
    });
    return Array.from(set).sort();
  }, [master]);

  // --- 3. Helper: Check if date string matches selected period ---
  const matchPeriod = useCallback(
    (dateStr, bulanLemburStr = '') => {
      if (periodPreset === 'ALL') return true;

      if (periodPreset === 'CUSTOM') {
        if (!customMonth || customMonth === 'ALL') return true;
        if (bulanLemburStr && bulanLemburStr.trim() === customMonth) return true;
        return getMonthStringFromDate(dateStr) === customMonth;
      }

      if (!dateStr) return false;
      const parts = String(dateStr).split('-');
      if (parts.length < 2) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (isNaN(y) || isNaN(m)) return false;

      if (periodPreset === 'THIS_MONTH') {
        return y === curYear && m === curMonth;
      }
      if (periodPreset === 'LAST_MONTH') {
        const targetYear = curMonth === 0 ? curYear - 1 : curYear;
        const targetMonth = curMonth === 0 ? 11 : curMonth - 1;
        return y === targetYear && m === targetMonth;
      }
      if (periodPreset === 'THIS_YEAR') {
        return y === curYear;
      }
      return true;
    },
    [periodPreset, customMonth, curYear, curMonth]
  );

  // Human-readable period label
  const periodLabel = useMemo(() => {
    if (periodPreset === 'ALL') return 'Semua Waktu (All Time)';
    if (periodPreset === 'THIS_MONTH') return `Bulan Ini (${MONTH_NAMES[curMonth]} ${curYear})`;
    if (periodPreset === 'LAST_MONTH') {
      const targetMonth = curMonth === 0 ? 11 : curMonth - 1;
      const targetYear = curMonth === 0 ? curYear - 1 : curYear;
      return `Bulan Lalu (${MONTH_NAMES[targetMonth]} ${targetYear})`;
    }
    if (periodPreset === 'THIS_YEAR') return `Tahun Ini (${curYear} YTD)`;
    if (periodPreset === 'CUSTOM') return customMonth === 'ALL' ? 'Semua Bulan' : customMonth;
    return 'Kustom';
  }, [periodPreset, customMonth, curMonth, curYear]);

  // --- 4. Filtering Engine for Izin & Lembur ---
  const filteredIzin = useMemo(() => {
    return izin.filter((x) => {
      // 1. Period
      if (!matchPeriod(x.tanggal_izin_mulai)) return false;

      // 2. Status
      const st = normalizeStatus(x.status);
      if (statusFilter === 'ALL_DECIDED' && st === 'PENDING') return false;
      if (statusFilter === 'APPROVED' && st !== 'APPROVED') return false;
      if (statusFilter === 'REJECTED' && st !== 'REJECTED') return false;

      // 3. Department
      const emp = master.find((m) => m.id_karyawan === x.id_karyawan);
      const empDept = emp?.departemen || 'Umum';
      if (deptFilter !== 'ALL' && empDept !== deptFilter) return false;

      // 4. Search Query
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
      // 1. Period
      if (!matchPeriod(x.tanggal_lembur, x.bulan_lembur)) return false;

      // 2. Status
      const st = normalizeStatus(x.status);
      if (statusFilter === 'ALL_DECIDED' && st === 'PENDING') return false;
      if (statusFilter === 'APPROVED' && st !== 'APPROVED') return false;
      if (statusFilter === 'REJECTED' && st !== 'REJECTED') return false;

      // 3. Department
      const emp = master.find((m) => m.id_karyawan === x.id_karyawan);
      const empDept = emp?.departemen || 'Umum';
      if (deptFilter !== 'ALL' && empDept !== deptFilter) return false;

      // 4. Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const nm = getNama(x, master).toLowerCase();
        const idK = String(x.id_karyawan || '').toLowerCase();
        const als = String(x.alasan || '').toLowerCase();
        const bln = String(x.bulan_lembur || '').toLowerCase();
        const dpt = empDept.toLowerCase();
        if (!nm.includes(q) && !idK.includes(q) && !als.includes(q) && !bln.includes(q) && !dpt.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [lembur, master, matchPeriod, statusFilter, deptFilter, search]);

  // --- 5. Executive KPIs Calculation ---
  const kpiData = useMemo(() => {
    let jamLemburApproved = 0;
    let jamLemburRejected = 0;
    let hariCutiTerpotong = 0;
    let hariIzinLainnya = 0;

    filteredLembur.forEach((l) => {
      const dur = parseFloat(l.durasi) || 0;
      if (normalizeStatus(l.status) === 'APPROVED') {
        jamLemburApproved += dur;
      } else if (normalizeStatus(l.status) === 'REJECTED') {
        jamLemburRejected += dur;
      }
    });

    filteredIzin.forEach((i) => {
      if (normalizeStatus(i.status) === 'APPROVED') {
        const potong = getHariPotongCuti(i);
        const totalHari = daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir);
        hariCutiTerpotong += potong;
        hariIzinLainnya += Math.max(0, totalHari - potong);
      }
    });

    const totalDecided =
      filteredIzin.filter((i) => normalizeStatus(i.status) !== 'PENDING').length +
      filteredLembur.filter((l) => normalizeStatus(l.status) !== 'PENDING').length;

    const totalApproved =
      filteredIzin.filter((i) => normalizeStatus(i.status) === 'APPROVED').length +
      filteredLembur.filter((l) => normalizeStatus(l.status) === 'APPROVED').length;

    const approvalRate = totalDecided > 0 ? ((totalApproved / totalDecided) * 100).toFixed(1) : '100.0';

    // Unique active headcount
    const activeHeadcountSet = new Set();
    filteredIzin.forEach((i) => i.id_karyawan && activeHeadcountSet.add(i.id_karyawan));
    filteredLembur.forEach((l) => l.id_karyawan && activeHeadcountSet.add(l.id_karyawan));

    return {
      jamLemburApproved: Math.round(jamLemburApproved * 10) / 10,
      jamLemburRejected: Math.round(jamLemburRejected * 10) / 10,
      hariCutiTerpotong,
      hariIzinLainnya,
      totalDecided,
      totalApproved,
      approvalRate,
      activeHeadcount: activeHeadcountSet.size,
    };
  }, [filteredIzin, filteredLembur]);

  // --- 6. Per-Employee Rollup (Rangkuman Karyawan) ---
  const karyawanRollup = useMemo(() => {
    // Annual leave usage helper across ALL approved permits this calendar year
    const annualLeaveUsageMap = {};
    izin.forEach((i) => {
      if (normalizeStatus(i.status) === 'APPROVED' && i.id_karyawan) {
        const d = String(i.tanggal_izin_mulai || '');
        if (d.startsWith(String(curYear))) {
          const potong = getHariPotongCuti(i);
          annualLeaveUsageMap[i.id_karyawan] = (annualLeaveUsageMap[i.id_karyawan] || 0) + potong;
        }
      }
    });

    const list = master.map((emp) => {
      const empIzin = filteredIzin.filter((i) => i.id_karyawan === emp.id_karyawan);
      const empLembur = filteredLembur.filter((l) => l.id_karyawan === emp.id_karyawan);

      let jamLemburAcc = 0;
      let jamLemburRej = 0;
      empLembur.forEach((l) => {
        const dur = parseFloat(l.durasi) || 0;
        if (normalizeStatus(l.status) === 'APPROVED') jamLemburAcc += dur;
        else if (normalizeStatus(l.status) === 'REJECTED') jamLemburRej += dur;
      });

      let hariCutiTerpotongPeriod = 0;
      let hariIzinLainPeriod = 0;
      empIzin.forEach((i) => {
        if (normalizeStatus(i.status) === 'APPROVED') {
          const potong = getHariPotongCuti(i);
          const total = daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir);
          hariCutiTerpotongPeriod += potong;
          hariIzinLainPeriod += Math.max(0, total - potong);
        }
      });

      const jatahAwal = emp.jatah_cuti ?? 12;
      const annualUsed = annualLeaveUsageMap[emp.id_karyawan] || 0;
      const sisaCuti = Math.max(0, jatahAwal - annualUsed);

      const totalAktivitas = empIzin.length + empLembur.length;

      return {
        id_karyawan: emp.id_karyawan,
        nama_karyawan: emp.nama_karyawan,
        departemen: emp.departemen || 'Umum',
        jabatan: emp.jabatan || 'Karyawan',
        jatahAwal,
        annualUsed,
        sisaCuti,
        hariCutiTerpotongPeriod,
        hariIzinLainPeriod,
        jamLemburAcc: Math.round(jamLemburAcc * 10) / 10,
        jamLemburRej: Math.round(jamLemburRej * 10) / 10,
        countIzin: empIzin.length,
        countLembur: empLembur.length,
        totalAktivitas,
        empRaw: emp,
      };
    });

    // Apply department & search filter directly to employee rollup as well
    const filteredList = list.filter((emp) => {
      if (deptFilter !== 'ALL' && emp.departemen !== deptFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const nm = emp.nama_karyawan.toLowerCase();
        const idK = emp.id_karyawan.toLowerCase();
        const dpt = emp.departemen.toLowerCase();
        const jbt = emp.jabatan.toLowerCase();
        if (!nm.includes(q) && !idK.includes(q) && !dpt.includes(q) && !jbt.includes(q)) {
          return false;
        }
      }
      return true;
    });

    // Sort
    return filteredList.sort((a, b) => {
      if (sortBy === 'nama_asc') return a.nama_karyawan.localeCompare(b.nama_karyawan);
      if (sortBy === 'nama_desc') return b.nama_karyawan.localeCompare(a.nama_karyawan);
      if (sortBy === 'lembur_desc') return b.jamLemburAcc - a.jamLemburAcc;
      if (sortBy === 'sisa_cuti_asc') return a.sisaCuti - b.sisaCuti;
      if (sortBy === 'dept') return a.departemen.localeCompare(b.departemen);
      return 0;
    });
  }, [master, filteredIzin, filteredLembur, izin, curYear, deptFilter, search, sortBy]);

  // --- 7. Department Analytics Distribution ---
  const departmentAnalytics = useMemo(() => {
    const map = {};
    departments.forEach((d) => {
      map[d] = { dept: d, jamLembur: 0, hariCuti: 0, headcount: 0 };
    });
    if (!map['Umum']) map['Umum'] = { dept: 'Umum', jamLembur: 0, hariCuti: 0, headcount: 0 };

    master.forEach((m) => {
      const d = m.departemen || 'Umum';
      if (!map[d]) map[d] = { dept: d, jamLembur: 0, hariCuti: 0, headcount: 0 };
      map[d].headcount += 1;
    });

    filteredLembur.forEach((l) => {
      if (normalizeStatus(l.status) === 'APPROVED') {
        const emp = master.find((m) => m.id_karyawan === l.id_karyawan);
        const d = emp?.departemen || 'Umum';
        if (!map[d]) map[d] = { dept: d, jamLembur: 0, hariCuti: 0, headcount: 0 };
        map[d].jamLembur += parseFloat(l.durasi) || 0;
      }
    });

    filteredIzin.forEach((i) => {
      if (normalizeStatus(i.status) === 'APPROVED') {
        const emp = master.find((m) => m.id_karyawan === i.id_karyawan);
        const d = emp?.departemen || 'Umum';
        if (!map[d]) map[d] = { dept: d, jamLembur: 0, hariCuti: 0, headcount: 0 };
        map[d].hariCuti += getHariPotongCuti(i);
      }
    });

    const arr = Object.values(map);
    const maxLembur = Math.max(...arr.map((x) => x.jamLembur), 1);
    const maxCuti = Math.max(...arr.map((x) => x.hariCuti), 1);

    return {
      list: arr,
      maxLembur,
      maxCuti,
    };
  }, [departments, master, filteredLembur, filteredIzin]);

  // --- 8. MULTI-SHEET ENTERPRISE EXCEL EXPORTER ---
  const exportEnterpriseMaster = () => {
    if (!filteredIzin.length && !filteredLembur.length && !karyawanRollup.length) {
      return notify('❌ Tidak ada data yang sesuai filter untuk diekspor.');
    }

    const wb = XLSX.utils.book_new();
    const stamp = formatDateTime(new Date());

    // 1. Sheet: Ringkasan Eksekutif (Metadata & KPI)
    const execSummaryData = [
      { Parameter: 'LAPORAN REKAPITULASI SDM & AUDIT TRAIL', Nilai: 'PT ARASA SOLUSI INDONESIA' },
      { Parameter: 'Portal Sistem', Nilai: 'Arasa Enterprise HR Portal v2.0' },
      { Parameter: 'Waktu Pengunduhan', Nilai: stamp },
      { Parameter: 'Filter Periode', Nilai: periodLabel },
      { Parameter: 'Filter Departemen', Nilai: deptFilter === 'ALL' ? 'Semua Departemen' : deptFilter },
      { Parameter: 'Filter Status Approval', Nilai: statusFilter },
      { Parameter: '', Nilai: '' },
      { Parameter: 'RINGKASAN METRIK UTAMA (KPI)', Nilai: '' },
      { Parameter: 'Total Karyawan Terdaftar', Nilai: `${master.length} Orang` },
      { Parameter: 'Karyawan Aktif Periode Ini', Nilai: `${kpiData.activeHeadcount} Orang` },
      { Parameter: 'Total Jam Lembur Disetujui', Nilai: `${kpiData.jamLemburApproved} Jam` },
      { Parameter: 'Total Jam Lembur Ditolak', Nilai: `${kpiData.jamLemburRejected} Jam` },
      { Parameter: 'Total Hari Cuti Dipotong', Nilai: `${kpiData.hariCutiTerpotong} Hari` },
      { Parameter: 'Total Hari Izin/Sakit Non-Potong', Nilai: `${kpiData.hariIzinLainnya} Hari` },
      { Parameter: 'Tingkat Persetujuan (Approval Rate)', Nilai: `${kpiData.approvalRate}%` },
    ];
    const wsExec = XLSX.utils.json_to_sheet(execSummaryData);
    wsExec['!cols'] = [{ wch: 38 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsExec, 'Ringkasan Eksekutif');

    // 2. Sheet: Rangkuman per Karyawan
    const rollupSheetData = karyawanRollup.map((k, idx) => ({
      No: idx + 1,
      'ID Karyawan': k.id_karyawan,
      'Nama Karyawan': k.nama_karyawan,
      Departemen: k.departemen,
      Jabatan: k.jabatan,
      'Jatah Cuti Awal': k.jatahAwal,
      'Cuti Terpakai Periode Ini': k.hariCutiTerpotongPeriod,
      'Total Cuti Tahunan Terpakai': k.annualUsed,
      'Sisa Saldo Cuti': k.sisaCuti,
      'Izin Non-Potong (Hari)': k.hariIzinLainPeriod,
      'Jam Lembur Disetujui (Jam)': k.jamLemburAcc,
      'Jam Lembur Ditolak (Jam)': k.jamLemburRej,
      'Frekuensi Lembur (Kali)': k.countLembur,
      'Frekuensi Izin (Kali)': k.countIzin,
    }));
    const wsRollup = XLSX.utils.json_to_sheet(rollupSheetData);
    wsRollup['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 24 },
      { wch: 24 },
      { wch: 16 },
      { wch: 20 },
      { wch: 26 },
      { wch: 24 },
      { wch: 22 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, wsRollup, 'Rangkuman Karyawan');

    // 3. Sheet: Detail Log Izin & Cuti
    const izinSheetData = filteredIzin.map((i, idx) => {
      const emp = master.find((m) => m.id_karyawan === i.id_karyawan);
      const potong = getHariPotongCuti(i);
      const total = daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir);
      return {
        No: idx + 1,
        'ID Karyawan': i.id_karyawan,
        'Nama Karyawan': getNama(i, master),
        Departemen: emp?.departemen || 'Umum',
        'Rentang Tanggal': formatRentangTanggal(i.tanggal_izin_mulai, i.tanggal_izin_akhir),
        'Tanggal Mulai': formatTanggal(i.tanggal_izin_mulai),
        'Tanggal Akhir': formatTanggal(i.tanggal_izin_akhir),
        'Total Hari': total,
        'Kategori Izin': i.kategori_izin,
        'Potong Cuti Tahunan': potong > 0 ? `Ya (${potong} Hari)` : 'Tidak (0 Hari)',
        'Alasan / Justifikasi': i.alasan || '-',
        Status: normalizeStatus(i.status),
        'Tanggal Pengajuan': i.created_at ? formatDateTime(i.created_at) : '-',
      };
    });
    const wsIzin = XLSX.utils.json_to_sheet(izinSheetData);
    wsIzin['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 26 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 18 },
      { wch: 22 },
      { wch: 35 },
      { wch: 14 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsIzin, 'Log Izin & Cuti');

    // 4. Sheet: Detail Log Lembur
    const lemburSheetData = filteredLembur.map((l, idx) => {
      const emp = master.find((m) => m.id_karyawan === l.id_karyawan);
      return {
        No: idx + 1,
        'ID Karyawan': l.id_karyawan,
        'Nama Karyawan': getNama(l, master),
        Departemen: emp?.departemen || 'Umum',
        'Tanggal Lembur': formatTanggal(l.tanggal_lembur, 'long'),
        'Waktu Lembur': formatRentangJam(l.jam_awal, l.jam_selesai),
        'Jam Awal': formatJam(l.jam_awal, false),
        'Jam Selesai': formatJam(l.jam_selesai, false),
        'Durasi (Jam)': parseFloat(l.durasi) || 0,
        'Format Jam': formatTeksJam(l.durasi),
        'Bulan Rekap': l.bulan_lembur,
        'Pekerjaan / Alasan': l.alasan || '-',
        Status: normalizeStatus(l.status),
        'Tanggal Pengajuan': l.created_at ? formatDateTime(l.created_at) : '-',
      };
    });
    const wsLembur = XLSX.utils.json_to_sheet(lemburSheetData);
    wsLembur['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 26 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 35 },
      { wch: 14 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsLembur, 'Log Lembur');

    const cleanPeriodName = periodLabel.replace(/[\s/\\?%*:|"<>]+/g, '_');
    const fileName = `Rekap_SDM_Arasa_${cleanPeriodName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    notify('✅ Laporan Komprehensif Multi-Sheet berhasil diunduh!');
  };

  // Standalone Single-Tab Exporters
  const exportIzinOnly = () => {
    if (!filteredIzin.length) return notify('❌ Data Izin kosong.');
    const data = filteredIzin.map((i, idx) => ({
      No: idx + 1,
      'ID Karyawan': i.id_karyawan,
      'Nama Karyawan': getNama(i, master),
      'Rentang Tanggal': formatRentangTanggal(i.tanggal_izin_mulai, i.tanggal_izin_akhir),
      'Total Hari': daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir),
      Kategori: i.kategori_izin,
      'Potong Cuti': getHariPotongCuti(i) > 0 ? `${getHariPotongCuti(i)} Hari` : '0 (Tidak)',
      Alasan: i.alasan || '-',
      Status: normalizeStatus(i.status),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Data Izin');
    XLSX.writeFile(wb, `Laporan_Izin_Arasa_${periodLabel.replace(/\s+/g, '_')}.xlsx`);
    notify('Laporan Izin berhasil diunduh!');
  };

  const exportLemburOnly = () => {
    if (!filteredLembur.length) return notify('❌ Data Lembur kosong.');
    const data = filteredLembur.map((l, idx) => ({
      No: idx + 1,
      'ID Karyawan': l.id_karyawan,
      'Nama Karyawan': getNama(l, master),
      'Tanggal Lembur': formatTanggal(l.tanggal_lembur, 'long'),
      Waktu: formatRentangJam(l.jam_awal, l.jam_selesai),
      'Durasi (Jam)': parseFloat(l.durasi) || 0,
      'Durasi Teks': formatTeksJam(l.durasi),
      Alasan: l.alasan || '-',
      Status: normalizeStatus(l.status),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Data Lembur');
    XLSX.writeFile(wb, `Laporan_Lembur_Arasa_${periodLabel.replace(/\s+/g, '_')}.xlsx`);
    notify('Laporan Lembur berhasil diunduh!');
  };

  // Reset filters
  const resetFilters = () => {
    setPeriodPreset('ALL');
    setCustomMonth('ALL');
    setDeptFilter('ALL');
    setStatusFilter('ALL_DECIDED');
    setSearch('');
    setSortBy('nama_asc');
    notify('Filter berhasil direset.');
  };

  // Drilldown records for selected employee in modal
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
         1. Executive Header & Export Action Hub
         ========================================================= */}
      <div className="rekap-header-card">
        <div className="rekap-title-wrap">
          <div className="rekap-title-icon">
            <FileSpreadsheet size={26} />
          </div>
          <div className="rekap-title-text">
            <h1>Rekap &amp; Analitik HR</h1>
            <p>Executive Ledger, Audit Trail, dan Rekapitulasi Multinasional.</p>
          </div>
        </div>

        <div className="rekap-header-actions">
          <button className="btn-export-sub" onClick={exportIzinOnly} title="Ekspor Log Izin & Cuti">
            <FileText size={14} />
            Ekspor Izin
          </button>
          <button className="btn-export-sub" onClick={exportLemburOnly} title="Ekspor Log Lembur">
            <Clock size={14} />
            Ekspor Lembur
          </button>
          <button
            className="btn-export-main"
            onClick={exportEnterpriseMaster}
            title="Ekspor Seluruh Data ke Excel Multi-Sheet Komprehensif"
          >
            <Download size={16} />
            Download Laporan Lengkap (Excel)
          </button>
        </div>
      </div>

      {/* =========================================================
         2. Executive KPI Ribbon (4 Metric Cards)
         ========================================================= */}
      <div className="rekap-kpi-grid">
        <div className="rekap-kpi-card">
          <div className="rekap-kpi-icon-bubble indigo">
            <Clock size={22} />
          </div>
          <div className="rekap-kpi-info">
            <span className="rekap-kpi-label">Jam Lembur Disetujui</span>
            <span className="rekap-kpi-value">{kpiData.jamLemburApproved} Jam</span>
            <span className="rekap-kpi-sub">
              {kpiData.jamLemburRejected > 0 ? `${kpiData.jamLemburRejected} jam ditolak` : '0 jam ditolak'}
            </span>
          </div>
        </div>

        <div className="rekap-kpi-card">
          <div className="rekap-kpi-icon-bubble emerald">
            <Calendar size={22} />
          </div>
          <div className="rekap-kpi-info">
            <span className="rekap-kpi-label">Cuti &amp; Izin Terpakai</span>
            <span className="rekap-kpi-value">{kpiData.hariCutiTerpotong} Hari</span>
            <span className="rekap-kpi-sub">
              {kpiData.hariIzinLainnya > 0 ? `+${kpiData.hariIzinLainnya} hari izin non-potong` : 'Jatah cuti tahunan'}
            </span>
          </div>
        </div>

        <div className="rekap-kpi-card">
          <div className="rekap-kpi-icon-bubble amber">
            <CheckCircle2 size={22} />
          </div>
          <div className="rekap-kpi-info">
            <span className="rekap-kpi-label">Approval Rate</span>
            <span className="rekap-kpi-value">{kpiData.approvalRate}%</span>
            <span className="rekap-kpi-sub">
              {kpiData.totalApproved} ACC dari {kpiData.totalDecided} diproses
            </span>
          </div>
        </div>

        <div className="rekap-kpi-card">
          <div className="rekap-kpi-icon-bubble blue">
            <Users size={22} />
          </div>
          <div className="rekap-kpi-info">
            <span className="rekap-kpi-label">Partisipasi Karyawan</span>
            <span className="rekap-kpi-value">
              {kpiData.activeHeadcount} / {master.length}
            </span>
            <span className="rekap-kpi-sub">
              {master.length > 0
                ? `${((kpiData.activeHeadcount / master.length) * 100).toFixed(0)}% karyawan aktif mengajukan`
                : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================
         3. Smart Multinational Filter Panel
         ========================================================= */}
      <div className="rekap-filter-panel">
        {/* Preset quick filter row */}
        <div className="rekap-preset-row">
          <div className="rekap-presets">
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginRight: 4 }}>
              Periode:
            </span>
            <button
              className={`preset-chip ${periodPreset === 'ALL' ? 'active' : ''}`}
              onClick={() => setPeriodPreset('ALL')}
            >
              Semua Waktu
            </button>
            <button
              className={`preset-chip ${periodPreset === 'THIS_MONTH' ? 'active' : ''}`}
              onClick={() => setPeriodPreset('THIS_MONTH')}
            >
              Bulan Ini
            </button>
            <button
              className={`preset-chip ${periodPreset === 'LAST_MONTH' ? 'active' : ''}`}
              onClick={() => setPeriodPreset('LAST_MONTH')}
            >
              Bulan Lalu
            </button>
            <button
              className={`preset-chip ${periodPreset === 'THIS_YEAR' ? 'active' : ''}`}
              onClick={() => setPeriodPreset('THIS_YEAR')}
            >
              Tahun Ini (YTD)
            </button>
            <button
              className={`preset-chip ${periodPreset === 'CUSTOM' ? 'active' : ''}`}
              onClick={() => setPeriodPreset('CUSTOM')}
            >
              Kustom Bulan
            </button>
          </div>

          <div className="rekap-period-label">
            <Calendar size={13} />
            {periodLabel}
          </div>
        </div>

        {/* Filter controls row */}
        <div className="rekap-controls-row">
          {/* Search */}
          <div className="filter-input-wrap">
            <Search size={16} className="filter-icon-left" />
            <input
              type="text"
              className="filter-input"
              placeholder="Cari nama karyawan, ID, departemen, alasan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Custom Month Dropdown (shown or enabled if CUSTOM is active) */}
          {periodPreset === 'CUSTOM' ? (
            <select
              className="filter-select"
              value={customMonth}
              onChange={(e) => setCustomMonth(e.target.value)}
            >
              <option value="ALL">Pilih Bulan...</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            /* Department Filter */
            <select
              className="filter-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="ALL">Semua Departemen ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          {/* Department Filter (if custom month is active, place here) */}
          {periodPreset === 'CUSTOM' ? (
            <select
              className="filter-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="ALL">Semua Departemen</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : (
            /* Status Filter */
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL_DECIDED">Selesai (ACC &amp; Reject)</option>
              <option value="APPROVED">Hanya Disetujui (Approved)</option>
              <option value="REJECTED">Hanya Ditolak (Rejected)</option>
              <option value="ALL">Semua (+ Termasuk Pending)</option>
            </select>
          )}

          {/* Reset button */}
          <button className="filter-reset-btn" onClick={resetFilters} title="Reset Semua Filter">
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      </div>

      {/* =========================================================
         4. View Segmented Tabs & Active Results Bar
         ========================================================= */}
      <div className="rekap-tabs-bar">
        <div className="rekap-segmented">
          <button
            className={`rekap-tab-btn ${activeTab === 'karyawan' ? 'active' : ''}`}
            onClick={() => setActiveTab('karyawan')}
          >
            <Users size={14} />
            Rangkuman Karyawan
            <span className="rekap-tab-count">{karyawanRollup.length}</span>
          </button>

          <button
            className={`rekap-tab-btn ${activeTab === 'izin' ? 'active' : ''}`}
            onClick={() => setActiveTab('izin')}
          >
            <Calendar size={14} />
            Log Izin &amp; Cuti
            <span className="rekap-tab-count">{filteredIzin.length}</span>
          </button>

          <button
            className={`rekap-tab-btn ${activeTab === 'lembur' ? 'active' : ''}`}
            onClick={() => setActiveTab('lembur')}
          >
            <Clock size={14} />
            Log Lembur
            <span className="rekap-tab-count">{filteredLembur.length}</span>
          </button>

          <button
            className={`rekap-tab-btn ${activeTab === 'analitik' ? 'active' : ''}`}
            onClick={() => setActiveTab('analitik')}
          >
            <BarChart3 size={14} />
            Distribusi Departemen
          </button>
        </div>

        {/* Sort selector for employee view */}
        {activeTab === 'karyawan' && (
          <div className="rekap-active-meta">
            <ArrowUpDown size={14} />
            <span>Urutkan:</span>
            <select
              className="rekap-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="nama_asc">Nama (A - Z)</option>
              <option value="nama_desc">Nama (Z - A)</option>
              <option value="lembur_desc">Jam Lembur Terbanyak</option>
              <option value="sisa_cuti_asc">Sisa Cuti Terendah</option>
              <option value="dept">Departemen</option>
            </select>
          </div>
        )}
      </div>

      {/* =========================================================
         5. VIEW 1: RANGKUMAN KARYAWAN (Rollup Ledger)
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
                    <th>Departemen</th>
                    <th>Jatah Cuti</th>
                    <th>Cuti Dipakai (Periode)</th>
                    <th>Sisa Saldo Cuti</th>
                    <th>Jam Lembur (ACC)</th>
                    <th>Lembur Ditolak</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {karyawanRollup.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                        Tidak ada data karyawan yang cocok dengan filter aktif.
                      </td>
                    </tr>
                  ) : (
                    karyawanRollup.map((emp) => {
                      const initials = emp.nama_karyawan
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      const isLowBalance = emp.sisaCuti <= 3;
                      const isZeroBalance = emp.sisaCuti === 0;

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
                            <strong>{emp.jatahAwal}</strong> Hari
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: emp.hariCutiTerpotongPeriod > 0 ? 'var(--primary)' : 'inherit' }}>
                              {emp.hariCutiTerpotongPeriod} Hari
                            </span>
                            {emp.hariIzinLainPeriod > 0 && (
                              <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>
                                (+{emp.hariIzinLainPeriod} izin non-potong)
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`balance-pill ${
                                isZeroBalance ? 'danger' : isLowBalance ? 'warning' : 'safe'
                              }`}
                            >
                              {emp.sisaCuti} Hari Sisa
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: emp.jamLemburAcc > 0 ? '#059669' : 'inherit' }}>
                              {emp.jamLemburAcc} Jam
                            </strong>
                            <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>
                              {emp.countLembur} sesi
                            </span>
                          </td>
                          <td>
                            <span style={{ color: emp.jamLemburRej > 0 ? '#dc2626' : '#94a3b8' }}>
                              {emp.jamLemburRej} Jam
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn-table-action"
                              onClick={() => {
                                setDrilldownEmp(emp);
                                setDrilldownSubTab('izin');
                              }}
                              title="Lihat Rincian Audit Trail Karyawan Ini"
                            >
                              <Eye size={12} />
                              Detail
                            </button>
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
            {karyawanRollup.length === 0 ? (
              <div className="empty">Tidak ada data karyawan yang cocok.</div>
            ) : (
              karyawanRollup.map((emp) => {
                const initials = emp.nama_karyawan
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

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
                      <span className="balance-pill safe">{emp.sisaCuti} Sisa Cuti</span>
                    </div>

                    <div className="rekap-card-stats-grid">
                      <div className="rekap-card-stat">
                        <span className="rekap-card-stat-label">Cuti Dipakai</span>
                        <span className="rekap-card-stat-val">{emp.hariCutiTerpotongPeriod} Hari</span>
                      </div>
                      <div className="rekap-card-stat">
                        <span className="rekap-card-stat-label">Jam Lembur (ACC)</span>
                        <span className="rekap-card-stat-val" style={{ color: '#059669' }}>
                          {emp.jamLemburAcc} Jam
                        </span>
                      </div>
                    </div>

                    <div className="rekap-card-footer">
                      <span>{emp.countIzin} Pengajuan Izin · {emp.countLembur} Sesi Lembur</span>
                      <button
                        className="btn-table-action"
                        onClick={() => {
                          setDrilldownEmp(emp);
                          setDrilldownSubTab('izin');
                        }}
                      >
                        <Eye size={12} />
                        Detail Audit
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* =========================================================
         6. VIEW 2: LOG DETAIL IZIN & CUTI (Granular Audit Trail)
         ========================================================= */}
      {activeTab === 'izin' && (
        <>
          {/* Desktop Table */}
          <div className="rekap-table-card">
            <div className="rekap-table-wrapper">
              <table className="rekap-table">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Departemen</th>
                    <th>Tanggal Izin</th>
                    <th>Durasi</th>
                    <th>Kategori</th>
                    <th>Status Potong Cuti</th>
                    <th>Alasan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIzin.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                        Tidak ada catatan izin yang sesuai filter.
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
                            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
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
                              <span className="potong-chip ya">✂️ Potong {potong} Hari</span>
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
              <div className="empty">Tidak ada catatan izin.</div>
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
                        <span className="rekap-card-stat-label">Rentang Waktu</span>
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
                        <span className="potong-chip ya">✂️ Potong {potong} Hari</span>
                      ) : (
                        <span className="potong-chip tidak">Tanpa Potong Cuti</span>
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
         7. VIEW 3: LOG DETAIL LEMBUR (Granular Overtime Trail)
         ========================================================= */}
      {activeTab === 'lembur' && (
        <>
          {/* Desktop Table */}
          <div className="rekap-table-card">
            <div className="rekap-table-wrapper">
              <table className="rekap-table">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Departemen</th>
                    <th>Tanggal Lembur</th>
                    <th>Jam Awal - Selesai</th>
                    <th>Durasi Lembur</th>
                    <th>Bulan Rekap</th>
                    <th>Alasan / Pekerjaan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLembur.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                        Tidak ada catatan lembur yang sesuai filter.
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
                          <td>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {l.bulan_lembur || '-'}
                            </span>
                          </td>
                          <td style={{ maxWidth: 220, fontSize: 12, color: 'var(--text-muted)' }}>
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
              <div className="empty">Tidak ada catatan lembur.</div>
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
                      <span>Bulan: {l.bulan_lembur || '-'}</span>
                      <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
         8. VIEW 4: DISTRIBUSI DEPARTEMEN & ANALYTICS WIDGET
         ========================================================= */}
      {activeTab === 'analitik' && (
        <div className="rekap-analytics-grid">
          {/* Overtime Ranking */}
          <div className="analytics-widget-card">
            <div className="analytics-widget-head">
              <span className="analytics-widget-title">
                <Clock size={16} color="var(--primary)" />
                Beban Jam Lembur per Departemen
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
                Total: {kpiData.jamLemburApproved} Jam
              </span>
            </div>

            <div className="dept-rank-list">
              {departmentAnalytics.list
                .sort((a, b) => b.jamLembur - a.jamLembur)
                .map((d) => {
                  const pct = Math.round((d.jamLembur / departmentAnalytics.maxLembur) * 100);
                  return (
                    <div className="dept-rank-item" key={d.dept}>
                      <div className="dept-rank-label-row">
                        <span className="dept-rank-name">{d.dept}</span>
                        <span className="dept-rank-val">{Math.round(d.jamLembur * 10) / 10} Jam</span>
                      </div>
                      <div className="dept-rank-bar-bg">
                        <div className="dept-rank-bar-fill" style={{ width: `${Math.max(pct, 4)}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Leave Ranking */}
          <div className="analytics-widget-card">
            <div className="analytics-widget-head">
              <span className="analytics-widget-title">
                <Calendar size={16} color="#059669" />
                Penggunaan Cuti Tahunan per Departemen
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>
                Total: {kpiData.hariCutiTerpotong} Hari
              </span>
            </div>

            <div className="dept-rank-list">
              {departmentAnalytics.list
                .sort((a, b) => b.hariCuti - a.hariCuti)
                .map((d) => {
                  const pct = Math.round((d.hariCuti / departmentAnalytics.maxCuti) * 100);
                  return (
                    <div className="dept-rank-item" key={d.dept}>
                      <div className="dept-rank-label-row">
                        <span className="dept-rank-name">{d.dept}</span>
                        <span className="dept-rank-val" style={{ color: '#059669' }}>
                          {d.hariCuti} Hari
                        </span>
                      </div>
                      <div className="dept-rank-bar-bg">
                        <div
                          className="dept-rank-bar-fill"
                          style={{
                            width: `${Math.max(pct, 4)}%`,
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
         9. EMPLOYEE DRILLDOWN MODAL (Audit Trail Deep-Dive)
         ========================================================= */}
      {drilldownEmp && (
        <Modal
          maxWidth="760px"
          onClose={() => setDrilldownEmp(null)}
          className="drilldown-modal-box"
        >
          {/* Header */}
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
                  #{drilldownEmp.id_karyawan} · {drilldownEmp.departemen} · {drilldownEmp.jabatan}
                </div>
              </div>
            </div>

            <span className="balance-pill safe" style={{ fontSize: 12, padding: '5px 12px' }}>
              Saldo Cuti: {drilldownEmp.sisaCuti} / {drilldownEmp.jatahAwal} Hari
            </span>
          </div>

          {/* Quick Metrics in Period */}
          <div className="drilldown-stats-grid">
            <div className="drilldown-stat-card">
              <span className="drilldown-stat-label">Cuti Dipotong (Periode)</span>
              <span className="drilldown-stat-val" style={{ color: 'var(--primary)' }}>
                {drilldownEmp.hariCutiTerpotongPeriod} Hari
              </span>
            </div>
            <div className="drilldown-stat-card">
              <span className="drilldown-stat-label">Izin Non-Potong</span>
              <span className="drilldown-stat-val">{drilldownEmp.hariIzinLainPeriod} Hari</span>
            </div>
            <div className="drilldown-stat-card">
              <span className="drilldown-stat-label">Lembur Disetujui</span>
              <span className="drilldown-stat-val" style={{ color: '#059669' }}>
                {drilldownEmp.jamLemburAcc} Jam
              </span>
            </div>
          </div>

          {/* Internal Tabs */}
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

          {/* Tab Content */}
          <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                            {durasi} Hari · Kategori: {i.kategori_izin}
                          </span>
                        </div>
                        <StatusBadge status={i.status} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', background: '#f8fafc', padding: '6px 10px', borderRadius: 8 }}>
                        {i.alasan || '-'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {potong > 0 ? `✂️ Memotong ${potong} Hari Jatah Cuti` : 'ℹ️ Tidak Memotong Jatah Cuti'}
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
                        {formatRentangJam(l.jam_awal, l.jam_selesai)} · {formatTeksJam(l.durasi)} ({parseFloat(l.durasi) || 0} Jam)
                      </span>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', background: '#f8fafc', padding: '6px 10px', borderRadius: 8 }}>
                    {l.alasan || '-'}
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
