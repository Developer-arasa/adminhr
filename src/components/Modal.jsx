import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({
  title,
  onClose,
  children,
  maxWidth,
  className = '',
}) {
  useEffect(() => {
    // 1. Kunci scroll body utama saat modal terbuka agar tidak scroll latar belakang
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    // 2. Listener tombol Escape untuk menutup modal
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (typeof document === 'undefined') {
    return null;
  }

  const modalContent = (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose && onClose()}
    >
      <div
        className={`modal-box ${className}`}
        style={maxWidth ? { maxWidth } : undefined}
      >
        <button
          className="btn-close-x"
          onClick={onClose}
          aria-label="Tutup"
          type="button"
        >
          ✕
        </button>
        {Boolean(title) && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  );

  // Render modal langsung ke document.body via Portal agar posisinya 100% fixed di layar monitor/HP
  // dan kebal dari transform parent/kontainer halaman yang panjang
  return createPortal(modalContent, document.body);
}
