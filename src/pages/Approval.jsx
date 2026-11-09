import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Trash2,
  Clock,
  Calendar,
  FileText,
  AlertTriangle,
  Sparkles,
  Zap,
  Check,
  Minus,
  Plus,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import {
  getNama,
  formatTeksJam,
  normalizeStatus,
  daySpan,
  getHariPotongCuti,
  formatTanggal,
  formatRentangTanggal,
  formatRentangJam,
} from '../lib/utils';

function initials(name) {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/);
  const a = parts[0]?.[0] || '?';
  const b = parts[1]?.[0] || '';
  return (a + b).toUpperCase();
}

export default function Approval() {
  const { izin, lembur, master, updateStatus, deleteRecord, bulkApproveLembur } =
    useAppStore();
  const notify = useToast();

  const [tab, setTab] = useState('izin');

  // Modal khusus Approval Izin (Pemotongan Cuti)
  const [izinModal, setIzinModal] = useState(null);
  const [potongMode, setPotongMode] = useState('FULL'); // 'FULL' | 'NONE' | 'CUSTOM'
  const [customHariPotong, setCustomHariPotong] = useState(1);
  const [submittingIzin, setSubmittingIzin] = useState(false);

  // Modal konfirmasi umum (Tolak / Lembur / Hapus)
  const [confirmModal, setConfirmModal] = useState(null);
  const [submittingConfirm, setSubmittingConfirm] = useState(false);

  const izinPending = izin.filter((x) => normalizeStatus(x.status) === 'PENDING');
  const lemburPending = lembur.filter((x) => normalizeStatus(x.status) === 'PENDING');

  // Buka popup approval Izin
  const handleOpenIzinModal = (item) => {
    const karyawan = master.find((m) => m.id_karyawan === item.id_karyawan);
    const thisYear = (item.tanggal_izin_mulai || new Date().toISOString()).slice(0, 4);

    const totalJatah = parseInt(karyawan?.jatah_cuti ?? 12, 10);
    const approvedIzin = izin.filter(
      (x) =>
        x.id_karyawan === item.id_karyawan &&
        normalizeStatus(x.status) === 'APPROVED' &&
        (x.tanggal_izin_mulai || '').startsWith(thisYear)
    );
    const cutiTerpakai = approvedIzin.reduce((acc, x) => acc + getHariPotongCuti(x), 0);
    const sisaCuti = totalJatah - cutiTerpakai;
    const totalHari = daySpan(item.tanggal_izin_mulai, item.tanggal_izin_akhir);

    setIzinModal({
      item,
      karyawan,
      totalJatah,
      cutiTerpakai,
      sisaCuti,
      totalHari,
    });
    setPotongMode('FULL');
    setCustomHariPotong(totalHari);
  };

  // Submit approval izin dengan opsi potong cuti
  const handleConfirmIzinApproval = async () => {
    if (!izinModal) return;
    const { item, totalHari } = izinModal;

    let hariPotong = totalHari;
    if (potongMode === 'NONE') {
      hariPotong = 0;
    } else if (potongMode === 'CUSTOM') {
      hariPotong = Math.max(0, Math.min(totalHari, customHariPotong));
    }

    const tag = hariPotong > 0 ? `[Potong Cuti: ${hariPotong} Hari]` : '[Tanpa Potong Cuti]';
    const cleanAlasan = (item.alasan || '')
      .replace(/\[Potong Cuti:.*?\]|\[Tanpa Potong Cuti\]/gi, '')
      .trim();
    const alasanBaru = tag + (cleanAlasan ? ` — ${cleanAlasan}` : '');

    setSubmittingIzin(true);
    try {
      await updateStatus('data_izin', item.id, 'IZIN_DIBERIKAN', {
        potongHari: hariPotong,
        alasanBaru,
      });
      notify(
        hariPotong > 0
          ? `Izin disetujui (Memotong ${hariPotong} hari jatah cuti).`
          : 'Izin disetujui tanpa pemotongan cuti.',
        'success'
      );
      setIzinModal(null);
    } catch (err) {
      console.error(err);
      notify('Gagal menyetujui pengajuan izin.', 'error');
    } finally {
      setSubmittingIzin(false);
    }
  };

  // Konfirmasi umum (Tolak Izin, Setujui/Tolak Lembur, Hapus)
  const openConfirm = (type, table, id, payload = {}) => {
    setConfirmModal({ type, table, id, payload });
  };

  const handleExecuteConfirm = async () => {
    if (!confirmModal) return;
    setSubmittingConfirm(true);
    try {
      if (confirmModal.type === 'DELETE') {
        await deleteRecord(confirmModal.table, confirmModal.id);
        notify('Data pengajuan berhasil dihapus.', 'success');
      } else if (confirmModal.type === 'UPDATE_STATUS') {
        await updateStatus(
          confirmModal.table,
          confirmModal.id,
          confirmModal.payload.status
        );
        notify('Status pengajuan berhasil diperbarui.', 'success');
      }
      setConfirmModal(null);
    } catch (err) {
      console.error(err);
      notify('Gagal memproses tindakan.', 'error');
    } finally {
      setSubmittingConfirm(false);
    }
  };

  const handleBulkLembur = async () => {
    if (!window.confirm(`Setujui sekaligus semua (${lemburPending.length}) pengajuan lembur?`)) {
      return;
    }
    try {
      await bulkApproveLembur();
      notify('Semua pengajuan lembur berhasil disetujui!', 'success');
    } catch (err) {
      console.error(err);
      notify('Gagal menyetujui lembur massal.', 'error');
    }
  };

  return (
    <div className="approval-container">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h2 className="page-title">Persetujuan &amp; Review</h2>
          <p className="page-sub">
            Kelola persetujuan izin, cuti tahunan, dan pengajuan lembur tim.
          </p>
        </div>
      </div>

      {/* Tabs Segmented Control */}
      <div className="approval-tabs">
        <button
          type="button"
          className={`approval-tab-btn ${tab === 'izin' ? 'active' : ''}`}
          onClick={() => setTab('izin')}
        >
          <FileText size={16} />
          <span>Izin &amp; Cuti</span>
          {izinPending.length > 0 && (
            <span className="approval-tab-badge">{izinPending.length}</span>
          )}
        </button>

        <button
          type="button"
          className={`approval-tab-btn ${tab === 'lembur' ? 'active' : ''}`}
          onClick={() => setTab('lembur')}
        >
          <Clock size={16} />
          <span>Lembur</span>
          {lemburPending.length > 0 && (
            <span className="approval-tab-badge">{lemburPending.length}</span>
          )}
        </button>
      </div>

      {/* =========================================================
          TAB 1: DAFTAR IZIN & CUTI PENDING
          ========================================================= */}
      {tab === 'izin' && (
        <div className="approval-content">
          {izinPending.length === 0 ? (
            <div className="empty-state-modern">
              <div className="empty-state-icon">
                <CheckCircle2 size={24} />
              </div>
              <h4 style={{ margin: 0, fontWeight: 700 }}>Semua Izin Telah Diproses</h4>
              <p className="empty-state-text">
                Tidak ada antrean pengajuan izin atau cuti yang menunggu saat ini.
              </p>
            </div>
          ) : (
            <div className="approval-list">
              {izinPending.map((i) => {
                const nama = getNama(i, master);
                const karyawan = master.find((m) => m.id_karyawan === i.id_karyawan);
                const durasi = daySpan(i.tanggal_izin_mulai, i.tanggal_izin_akhir);

                return (
                  <div key={i.id} className="approval-card">
                    <div className="approval-card-top">
                      <div className="approval-person">
                        <div className="approval-avatar blue">{initials(nama)}</div>
                        <div className="approval-person-info">
                          <span className="approval-person-name">{nama}</span>
                          <span className="approval-person-meta">
                            #{i.id_karyawan || '-'} · {karyawan?.jabatan || 'Karyawan'}
                          </span>
                        </div>
                      </div>

                      <span className="approval-type-badge blue">
                        📝 {i.kategori_izin || 'Izin'}
                      </span>
                    </div>

                    <div className="approval-card-details">
                      <div className="approval-detail-item">
                        <Calendar size={15} className="approval-detail-label" />
                        <span className="approval-detail-label">Tanggal:</span>
                        <span className="approval-detail-val">
                          {formatRentangTanggal(i.tanggal_izin_mulai, i.tanggal_izin_akhir, 'long')}
                        </span>
                      </div>

                      <div className="approval-detail-item">
                        <Clock size={15} className="approval-detail-label" />
                        <span className="approval-detail-label">Durasi:</span>
                        <span className="approval-detail-val">{durasi} Hari</span>
                      </div>

                      {i.alasan && (
                        <div className="approval-alasan-box">
                          💬 &ldquo;{i.alasan}&rdquo;
                        </div>
                      )}
                    </div>

                    <div className="approval-card-actions">
                      <button
                        type="button"
                        className="btn-reject-modern"
                        onClick={() =>
                          openConfirm('UPDATE_STATUS', 'data_izin', i.id, {
                            status: 'IZIN_TIDAK_DIBERIKAN',
                            title: `Tolak Izin ${nama}?`,
                            desc: `Pengajuan izin ${durasi} hari akan ditolak dan notifikasi penolakan akan dikirimkan.`,
                          })
                        }
                      >
                        <XCircle size={15} />
                        <span>Tolak</span>
                      </button>

                      <button
                        type="button"
                        className="btn-acc"
                        onClick={() => handleOpenIzinModal(i)}
                      >
                        <CheckCircle2 size={15} strokeWidth={2.5} />
                        <span>Setujui (ACC)</span>
                      </button>

                      <button
                        type="button"
                        className="btn-delete-modern"
                        title="Hapus Pengajuan"
                        onClick={() =>
                          openConfirm('DELETE', 'data_izin', i.id, {
                            title: `Hapus Permanen Data Izin?`,
                            desc: `Data pengajuan izin dari ${nama} akan dihapus dari sistem.`,
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          TAB 2: DAFTAR LEMBUR PENDING
          ========================================================= */}
      {tab === 'lembur' && (
        <div className="approval-content">
          {lemburPending.length === 0 ? (
            <div className="empty-state-modern">
              <div className="empty-state-icon">
                <CheckCircle2 size={24} />
              </div>
              <h4 style={{ margin: 0, fontWeight: 700 }}>Semua Lembur Telah Diproses</h4>
              <p className="empty-state-text">
                Tidak ada antrean lembur yang butuh persetujuan.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn-acc"
                  style={{ padding: '8px 18px', fontSize: 13 }}
                  onClick={handleBulkLembur}
                >
                  <Zap size={15} />
                  <span>Setujui Semua Lembur ({lemburPending.length})</span>
                </button>
              </div>

              <div className="approval-list">
                {lemburPending.map((l) => {
                  const nama = getNama(l, master);
                  const karyawan = master.find((m) => m.id_karyawan === l.id_karyawan);

                  return (
                    <div key={l.id} className="approval-card">
                      <div className="approval-card-top">
                        <div className="approval-person">
                          <div className="approval-avatar purple">{initials(nama)}</div>
                          <div className="approval-person-info">
                            <span className="approval-person-name">{nama}</span>
                            <span className="approval-person-meta">
                              #{l.id_karyawan || '-'} · {karyawan?.jabatan || 'Karyawan'}
                            </span>
                          </div>
                        </div>

                        <span className="approval-type-badge purple">
                          ⏰ Lembur
                        </span>
                      </div>

                      <div className="approval-card-details">
                        <div className="approval-detail-item">
                          <Calendar size={15} className="approval-detail-label" />
                          <span className="approval-detail-label">Tanggal:</span>
                          <span className="approval-detail-val">
                            {formatTanggal(l.tanggal_lembur, 'long')}
                          </span>
                        </div>

                        <div className="approval-detail-item">
                          <Clock size={15} className="approval-detail-label" />
                          <span className="approval-detail-label">Jam &amp; Durasi:</span>
                          <span className="approval-detail-val">
                            {formatRentangJam(l.jam_awal, l.jam_selesai)} ({formatTeksJam(l.durasi)})
                          </span>
                        </div>

                        {l.alasan && (
                          <div className="approval-alasan-box">
                            💬 &ldquo;{l.alasan}&rdquo;
                          </div>
                        )}
                      </div>

                      <div className="approval-card-actions">
                        <button
                          type="button"
                          className="btn-reject-modern"
                          onClick={() =>
                            openConfirm('UPDATE_STATUS', 'data_lembur', l.id, {
                              status: 'DITOLAK',
                              title: `Tolak Lembur ${nama}?`,
                              desc: `Pengajuan lembur tanggal ${formatTanggal(l.tanggal_lembur)} akan ditolak.`,
                            })
                          }
                        >
                          <XCircle size={15} />
                          <span>Tolak</span>
                        </button>

                        <button
                          type="button"
                          className="btn-acc"
                          onClick={() =>
                            openConfirm('UPDATE_STATUS', 'data_lembur', l.id, {
                              status: 'DISETUJUI',
                              title: `Setujui Lembur ${nama}?`,
                              desc: `Setujui pengajuan lembur ${formatTeksJam(l.durasi)} pada tanggal ${formatTanggal(l.tanggal_lembur)}.`,
                            })
                          }
                        >
                          <CheckCircle2 size={15} strokeWidth={2.5} />
                          <span>Setujui</span>
                        </button>

                        <button
                          type="button"
                          className="btn-delete-modern"
                          title="Hapus Pengajuan"
                          onClick={() =>
                            openConfirm('DELETE', 'data_lembur', l.id, {
                              title: `Hapus Permanen Data Lembur?`,
                              desc: `Catatan pengajuan lembur dari ${nama} akan dihapus.`,
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* =========================================================
          MODAL POPUP KHUSUS APPROVAL IZIN & POTONG CUTI
          ========================================================= */}
      {izinModal && (
        <Modal
          title=""
          onClose={() => !submittingIzin && setIzinModal(null)}
        >
          <div className="izin-modal-box">
            {/* Modal Header */}
            <div className="izin-modal-header">
              <div className="izin-modal-icon-bubble">
                <Sparkles size={22} />
              </div>
              <div>
                <h3>Konfirmasi Persetujuan Izin</h3>
                <p className="izin-modal-sub">
                  Tentukan kebijakan pemotongan saldo cuti tahunan karyawan.
                </p>
              </div>
            </div>

            {/* Summary Info Card */}
            <div className="izin-summary-card">
              <div className="izin-summary-row">
                <span className="izin-summary-label">Nama Karyawan</span>
                <span className="izin-summary-val">
                  {getNama(izinModal.item, master)} (#{izinModal.item.id_karyawan})
                </span>
              </div>
              <div className="izin-summary-row">
                <span className="izin-summary-label">Rentang Izin</span>
                <span className="izin-summary-val">
                  {formatRentangTanggal(izinModal.item.tanggal_izin_mulai, izinModal.item.tanggal_izin_akhir, 'long')} ({izinModal.totalHari} Hari)
                </span>
              </div>
              {izinModal.item.alasan && (
                <div className="izin-summary-row">
                  <span className="izin-summary-label">Alasan</span>
                  <span className="izin-summary-val" style={{ fontStyle: 'italic', fontWeight: 500 }}>
                    &ldquo;{izinModal.item.alasan}&rdquo;
                  </span>
                </div>
              )}
            </div>

            {/* Status Saldo Cuti Karyawan (3 Pills) */}
            <div>
              <div className="izin-options-label" style={{ marginBottom: 6 }}>
                Status Jatah Cuti Karyawan Saat Ini:
              </div>
              <div className="izin-balance-grid">
                <div className="izin-balance-pill blue">
                  <span className="izin-balance-val">{izinModal.totalJatah}</span>
                  <span className="izin-balance-lbl">Jatah Tahunan</span>
                </div>
                <div className="izin-balance-pill amber">
                  <span className="izin-balance-val">{izinModal.cutiTerpakai}</span>
                  <span className="izin-balance-lbl">Sudah Terpakai</span>
                </div>
                <div className="izin-balance-pill emerald">
                  <span className="izin-balance-val">{izinModal.sisaCuti}</span>
                  <span className="izin-balance-lbl">Sisa Cuti Tersedia</span>
                </div>
              </div>
            </div>

            {/* Pilihan Pemotongan Cuti */}
            <div className="izin-options-section">
              <div className="izin-options-label">
                Pilih Kebijakan Pemotongan:
              </div>

              {/* OPSI 1: Potong Cuti Penuh */}
              <div
                className={`izin-opt-card ${potongMode === 'FULL' ? 'selected' : ''}`}
                onClick={() => setPotongMode('FULL')}
              >
                <div className="izin-opt-radio">
                  {potongMode === 'FULL' && <div className="izin-opt-dot" />}
                </div>
                <div className="izin-opt-body">
                  <span className="izin-opt-title">
                    Potong Jatah Cuti ({izinModal.totalHari} Hari)
                  </span>
                  <span className="izin-opt-desc">
                    Mengurangi saldo cuti tahunan karyawan secara penuh ({izinModal.totalHari} hari).
                  </span>
                </div>
              </div>

              {/* OPSI 2: Tanpa Potong Cuti */}
              <div
                className={`izin-opt-card ${potongMode === 'NONE' ? 'selected' : ''}`}
                onClick={() => setPotongMode('NONE')}
              >
                <div className="izin-opt-radio">
                  {potongMode === 'NONE' && <div className="izin-opt-dot" />}
                </div>
                <div className="izin-opt-body">
                  <span className="izin-opt-title">
                    Izin Khusus / Tanpa Potong Cuti (0 Hari)
                  </span>
                  <span className="izin-opt-desc">
                    Pengajuan tetap disetujui &amp; tercatat resmi, namun jatah cuti karyawan tidak berkurang.
                  </span>
                </div>
              </div>

              {/* OPSI 3: Sebagian / Kombinasi (Hanya muncul jika izin > 1 hari) */}
              {izinModal.totalHari > 1 && (
                <>
                  <div
                    className={`izin-opt-card ${potongMode === 'CUSTOM' ? 'selected' : ''}`}
                    onClick={() => setPotongMode('CUSTOM')}
                  >
                    <div className="izin-opt-radio">
                      {potongMode === 'CUSTOM' && <div className="izin-opt-dot" />}
                    </div>
                    <div className="izin-opt-body">
                      <span className="izin-opt-title">
                        Bagi Sebagian (Kombinasi Potong Cuti &amp; Izin Khusus)
                      </span>
                      <span className="izin-opt-desc">
                        Atur berapa hari yang memotong cuti tahunan dan berapa hari yang bebas cuti.
                      </span>
                    </div>
                  </div>

                  {potongMode === 'CUSTOM' && (
                    <div className="izin-stepper-box">
                      <div className="izin-stepper-row">
                        <span className="izin-stepper-label">Jumlah Hari Potong Cuti:</span>
                        <div className="izin-stepper-controls">
                          <button
                            type="button"
                            className="stepper-btn"
                            disabled={customHariPotong <= 0}
                            onClick={() => setCustomHariPotong((v) => Math.max(0, v - 1))}
                          >
                            <Minus size={13} />
                          </button>
                          <span className="stepper-num">{customHariPotong}</span>
                          <button
                            type="button"
                            className="stepper-btn"
                            disabled={customHariPotong >= izinModal.totalHari}
                            onClick={() =>
                              setCustomHariPotong((v) => Math.min(izinModal.totalHari, v + 1))
                            }
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="izin-stepper-note">
                        💡 {customHariPotong} hari potong cuti +{' '}
                        {izinModal.totalHari - customHariPotong} hari izin khusus (total{' '}
                        {izinModal.totalHari} hari).
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Pratinjau Sisa Cuti Setelah Disetujui */}
            {(() => {
              const hariAkanPotong =
                potongMode === 'NONE'
                  ? 0
                  : potongMode === 'CUSTOM'
                  ? customHariPotong
                  : izinModal.totalHari;

              const sisaAkhir = izinModal.sisaCuti - hariAkanPotong;
              const isOver = sisaAkhir < 0;

              return (
                <div>
                  <div className="izin-preview-result">
                    <span className="izin-preview-label">
                      Sisa Cuti Setelah Approval Ini:
                    </span>
                    <span
                      className="izin-preview-val"
                      style={{ color: isOver ? '#b91c1c' : '#14532d' }}
                    >
                      {sisaAkhir} Hari (Akan terpotong {hariAkanPotong} hari)
                    </span>
                  </div>

                  {isOver && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: '#b91c1c',
                        fontSize: 11,
                        fontWeight: 600,
                        marginTop: 6,
                      }}
                    >
                      <AlertTriangle size={14} />
                      <span>
                        Peringatan: Pemotongan ini melebihi sisa cuti tersedia!
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div className="izin-modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={submittingIzin}
                onClick={() => setIzinModal(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-acc"
                disabled={submittingIzin}
                onClick={handleConfirmIzinApproval}
              >
                <Check size={16} strokeWidth={2.5} />
                <span>{submittingIzin ? 'Menyimpan...' : 'Setujui Pengajuan'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================
          MODAL KONFIRMASI UMUM (Tolak / Lembur / Hapus)
          ========================================================= */}
      {confirmModal && (
        <Modal title="" onClose={() => !submittingConfirm && setConfirmModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background:
                    confirmModal.type === 'DELETE'
                      ? '#fee2e2'
                      : confirmModal.payload?.status?.includes('TIDAK') ||
                        confirmModal.payload?.status === 'DITOLAK'
                      ? '#fee2e2'
                      : '#d1fae5',
                  color:
                    confirmModal.type === 'DELETE' ||
                    confirmModal.payload?.status?.includes('TIDAK') ||
                    confirmModal.payload?.status === 'DITOLAK'
                      ? '#dc2626'
                      : '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {confirmModal.type === 'DELETE' ? (
                  <Trash2 size={20} />
                ) : confirmModal.payload?.status?.includes('TIDAK') ||
                  confirmModal.payload?.status === 'DITOLAK' ? (
                  <XCircle size={20} />
                ) : (
                  <CheckCircle2 size={20} />
                )}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {confirmModal.payload?.title || 'Konfirmasi Tindakan'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  {confirmModal.payload?.desc || 'Apakah Anda yakin ingin melanjutkan tindakan ini?'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={submittingConfirm}
                onClick={() => setConfirmModal(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className={
                  confirmModal.type === 'DELETE' ||
                  confirmModal.payload?.status?.includes('TIDAK') ||
                  confirmModal.payload?.status === 'DITOLAK'
                    ? 'btn btn-danger'
                    : 'btn-acc'
                }
                disabled={submittingConfirm}
                onClick={handleExecuteConfirm}
              >
                <span>{submittingConfirm ? 'Memproses...' : 'Lanjutkan'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
