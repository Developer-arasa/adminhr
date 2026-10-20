import { normalizeStatus } from '../lib/utils';

const LABEL = {
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  PENDING: 'Menunggu',
};

export default function StatusBadge({ status }) {
  const key = normalizeStatus(status);
  return <span className={`status-badge ${key}`}>{LABEL[key]}</span>;
}
