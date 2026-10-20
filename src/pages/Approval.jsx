import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { getNama, formatTeksJam, normalizeStatus } from '../lib/utils';

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  const a = parts[0]?.[0] || '?';
  const b = parts[1]?.[0] || '';
  return (a + b).toUpperCase();
}

function Avatar({ name, tone }) {
  return <span className={`avatar ${tone}`}>{initials(name)}</span>;
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="info-row">
      <span className="info-ico">{icon}</span>
      <span className="info-label">{label}</span>
      <span className="info-val">{value}</span>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="empty-card">
      <span className="empty-ico">✅</span>
      <p>{text}</p>
    </div>
  );
}

export default function Approval() {
  const { izin, lembur, master, updateStatus, deleteRecord, bulkApproveLembur } = useAppStore();
  const notify = useToast();
  const [tab, setTab] = useState('izin');
  const [confirm, setConfirm] = useState(null);

  const izinPending = izin.filter((x) => normalizeStatus(x.status) === 'PENDING');
  const lemburPending = lembur.filter((x) => normalizeStatus(x.status) === 'PENDING');

  const doUpdate = (table, id, status) => {
    setConfirm({ table, id, status });
  };

  const confirmUpdate = async () => {
    try {
      await updateStatus(confirm.table, confirm.id, confirm.status);
      notify('Status berhasil diperbarui!', 'success');
    } catch (e) {
      notify('Gagal memperbarui status.', 'error');
    }
    setConfirm(null);
  };

  const doDelete = async (table, id) => {
    try {
      await deleteRecord(table, id);
      notify('Data berhasil dihapus.', 'success');
    } catch (e) {
      notify('Gagal menghapus data.', 'error');
    }
  };

  const doBulk = async () => {
    await bulkApproveLembur();
    notify('Semua lemburan disetujui!', 'success');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="page-title">Approval</h2>
          <p className="page-sub">Setujui atau tolak pengajuan izin &amp; lembur.</p>
        </div>
      </div>

      <div className="segmented" style={{ marginBottom: 16 }}>
        <button className={`btn ${tab === 'izin' ? 'active' : ''}`} onClick={() => setTab('izin')}>
          Izin
          <span className="seg-count">{izinPending.length}</span>
        </button>
        <button className={`btn ${tab === 'lembur' ? 'active' : ''}`} onClick={() => setTab('lembur')}>
          Lembur
          <span className="seg-count">{lemburPending.length}</span>
        </button>
      </div>

      {tab === 'izin' ? (
        izinPending.length === 0 ? (
          <EmptyState text="Semua izin sudah diproses." />
        ) : (
          <div className="req-list">
            {izinPending.map((i) => (
              <div className="req-card" key={i.id}>
                <div className="req-top">
                  <div className="req-person">
                    <Avatar name={getNama(i, master)} tone="blue" />
                    <div className="req-person-info">
                      <div className="req-title">{getNama(i, master)}</div>
                      <div className="req-meta">#{i.id_karyawan}</div>
                    </div>
                  </div>
                  <span className="type-chip blue">📝 Izin</span>
                </div>
                <div className="req-details">
                  <InfoRow icon="🗂️" label="Kategori" value={i.kategori_izin || '-'} />
                  <InfoRow icon="📅" label="Tanggal" value={`${i.tanggal_izin_mulai} → ${i.tanggal_izin_akhir}`} />
                  {i.alasan && <InfoRow icon="💬" label="Alasan" value={`"${i.alasan}"`} />}
                </div>
                <div className="req-actions">
                  <button className="btn btn-reject" onClick={() => doUpdate('data_izin', i.id, 'IZIN_TIDAK_DIBERIKAN')}>
                    ✕ Tolak
                  </button>
                  <button className="btn btn-primary" onClick={() => doUpdate('data_izin', i.id, 'IZIN_DIBERIKAN')}>
                    ✓ Setujui
                  </button>
                  <button className="btn btn-ghost btn-icon" onClick={() => doDelete('data_izin', i.id)} title="Hapus Permanen">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : lemburPending.length === 0 ? (
        <EmptyState text="Tidak ada antrean lembur." />
      ) : (
        <>
          <button className="btn btn-primary btn-block" style={{ marginBottom: 15 }} onClick={doBulk}>
            Setujui Semua Lembur
          </button>
          <div className="req-list">
            {lemburPending.map((l) => (
              <div className="req-card" key={l.id}>
                <div className="req-top">
                  <div className="req-person">
                    <Avatar name={getNama(l, master)} tone="indigo" />
                    <div className="req-person-info">
                      <div className="req-title">{getNama(l, master)}</div>
                      <div className="req-meta">#{l.id_karyawan}</div>
                    </div>
                  </div>
                  <span className="type-chip indigo">⏰ Lembur</span>
                </div>
                <div className="req-details">
                  <InfoRow icon="🕒" label="Jam" value={`${l.jam_awal} – ${l.jam_selesai}`} />
                  <InfoRow icon="⏱️" label="Durasi" value={formatTeksJam(l.durasi)} />
                  <InfoRow icon="📅" label="Tanggal" value={l.tanggal_lembur || '-'} />
                  {l.alasan && <InfoRow icon="💬" label="Alasan" value={`"${l.alasan}"`} />}
                </div>
                <div className="req-actions">
                  <button className="btn btn-reject" onClick={() => doUpdate('data_lembur', l.id, 'DITOLAK')}>
                    ✕ Tolak
                  </button>
                  <button className="btn btn-primary" onClick={() => doUpdate('data_lembur', l.id, 'DISETUJUI')}>
                    ✓ Setujui
                  </button>
                  <button className="btn btn-ghost btn-icon" onClick={() => doDelete('data_lembur', l.id)} title="Hapus Permanen">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {confirm && (
        <Modal title="Konfirmasi" onClose={() => setConfirm(null)}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Terapkan perubahan status pada pengajuan ini?
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirm(null)}>
              Batal
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmUpdate}>
              Yakin
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
