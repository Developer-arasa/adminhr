# Arasa HR — Blueprint Platform HR Dashboard (Web Terpisah)

> Dokumen ini adalah blueprint (bukan kode) untuk membangun **web HR dashboard admin desktop** yang terpisah dari portal karyawan, namun **berbagi database Supabase yang sama**.

---

## 1. Ringkasan & Tujuan

Membangun aplikasi web admin HR (desktop-focused) dengan fitur **Full**:

1. **CRUD Karyawan** — kelola data induk pegawai.
2. **Approval Izin & Lembur** — verifikasi/persetujuan pengajuan dari portal karyawan.
3. **Rekap / Laporan** — rekap izin & lembur per bulan/periode.
4. **Dashboard Statistik** — angka ringkasan & visualisasi.

Web ini **berdiri sendiri** (repo/folder terpisah) tetapi membaca/menulis ke **database Supabase yang sama** dengan portal karyawan `arasahr`.

---

## 2. Arsitektur & Teknologi

| Aspek | Pilihan |
|---|---|
| Frontend | React + Vite (SPA) |
| Routing | `react-router-dom` |
| State global | Zustand (pola sama dengan portal karyawan) |
| Data / API | Supabase JS client |
| Database | Supabase (berbagi DB portal karyawan) |
| Auth HR | **Lihat §4 (perlu konfirmasi)** |
| Styling | **Lihat §4 (perlu konfirmasi)** |

Struktur pola kode mengikuti portal karyawan yang sudah ada:
`lib/` (supabase client), `store/` (zustand), `pages/`, `components/`.

---

## 3. Skema Database (yang sudah ada — hasil audit)

### `master_data` (data induk karyawan)
Kolom relevan:
- `id_karyawan` (PK)
- `nama_karyawan`
- `pin` (default `'123456'`)
- `role` (default `'karyawan'`)
- `nik_ktp`, `jabatan`, `departemen`
- `tgl_gabung`, `tempat_lahir`, `tgl_lahir`
- `no_hp`, `alamat_domisili`, `status_nikah`, `kontak_darurat`

> Catatan: kolom `jabatan` & `departemen` **sudah ada** via `database/migration.sql` (line 11–12). Konfirmasi §4 hanya untuk memastikan sudah ter-migrate di instance produksi.

### `data_izin`
- `id` (PK), `id_karyawan`, `nama`
- `tanggal_izin_mulai`, `tanggal_izin_akhir`
- `kategori_izin` (alias `kategori`)
- `alasan`, `status`, `created_at`

### `data_lembur`
- `id` (PK), `id_karyawan`, `nama`
- `tanggal_lembur`, `bulan_lembur`
- `jam_awal`, `jam_selesai`, `durasi`
- `alasan`, `status`, `created_at`

---

## 4. Keputusan yang Perlu Dikonfirmasi (sebelum coding)

1. **Auth HR**
   - (a) Supabase Auth (email/password + RLS) — lebih aman, perlu setup RLS & policy.
   - (b) Tabel `hr_users` sederhana (email + password hash) — cepat, kontrol penuh.
   - Rekomendasi: **(a) Supabase Auth** untuk keamanan & skala.

2. **Field `jabatan` / `departemen`**
   - Sudah ada di `master_data` via migration? Perlu konfirmasi sudah jalan di DB produksi, atau perlu `ALTER TABLE` tambahan.

3. **Styling**
   - (a) Tailwind (cepat, utility-first).
   - (b) CSS Module / CSS biasa (konsisten dengan portal karyawan yang sudah pakai `theme.css` + `components.css`).
   - Rekomendasi: **(b) reuse token theme portal karyawan** agar tampilan seragam.

4. **Input manual HR**
   - HR **hanya approve** data dari portal karyawan (read-only + update status), atau
   - HR **bisa input izin/lembur manual** juga (create record atas nama karyawan).

---

## 5. Struktur Folder (target)

```
hr-dashboard/
├── index.html
├── package.json
├── vite.config.js
├── .env / .env.example
└── src/
    ├── main.jsx
    ├── App.jsx                    # routing + layout shell (sidebar/nav)
    ├── lib/
    │   └── supabase.js            # client supabase (shared env)
    ├── store/
    │   ├── authStore.js           # sesi login HR
    │   └── (opsional) uiStore.js
    ├── components/
    │   ├── Layout.jsx             # sidebar + topbar
    │   ├── StatusBadge.jsx        # mapping PENDING/DISETUJUI/DITOLAK
    │   ├── StatCard.jsx           # kartu angka di dashboard
    │   ├── DataTable.jsx          # tabel reusable
    │   └── Modal.jsx              # modal confirm/form
    ├── pages/
    │   ├── Login.jsx              # login HR
    │   ├── Dashboard.jsx          # statistik & ringkasan
    │   ├── Karyawan.jsx           # CRUD master_data
    │   ├── ApprovalIzin.jsx       # list + approve/tolak izin
    │   ├── ApprovalLembur.jsx     # list + approve/tolak lembur
    │   └── Rekap.jsx              # rekap/laporan (filter periode)
    └── styles/
        ├── theme.css              # token warna (reuse arasa crimson)
        ├── layout.css
        └── components.css
```

---

## 6. Halaman & Fitur Detail

### 6.1 Login HR
- Form email/password (atau kredensial sesuai keputusan §4.1).
- Simpan sesi ke `authStore` (Zustand + localStorage).
- Redirect ke Dashboard jika sudah login.

### 6.2 Dashboard (statistik)
- Kartu angka: total karyawan, izin pending, lembur pending, izin disetujui bulan ini, lembur bulan ini.
- Grafik ringkas (opsional): rekap per bulan, distribusi status.
- CTA cepat menuju halaman approval.

### 6.3 Karyawan (CRUD)
- List karyawan (tabel: id, nama, jabatan, departemen, status aktif).
- Cari / filter berdasarkan `nama_karyawan`, `departemen`, `jabatan`.
- Tambah / Edit / Hapus record di `master_data`.
- Autocomplete ketat `id_karyawan` (pola legacy dipertahankan) saat memilih karyawan di form lain.

### 6.4 Approval Izin
- List pengajuan `data_izin` dengan filter status.
- Detail: karyawan, kategori, rentang tanggal, alasan.
- Aksi: **Setujui** / **Tolak** (update `status`).
- Badge warna sesuai mapping §3.

### 6.5 Approval Lembur
- List pengajuan `data_lembur` dengan filter status & `bulan_lembur`.
- Kalender lembur per bulan (pola legacy dipertahankan).
- Aksi: **Setujui** / **Tolak**.

### 6.6 Rekap / Laporan
- Filter periode (bulan / rentang tanggal).
- Tabel rekap per karyawan: total izin, total jam lembur, status.
- Export (opsional): CSV / PDF.

---

## 7. Flow Penting

1. **Login** → `authStore` set sesi → redirect `/dashboard`.
2. **Approval** → update `status` di `data_izin`/`data_lembur` → refetch list → badge berubah warna.
3. **CRUD karyawan** → insert/update/delete `master_data` → refetch list.
4. **Rekap** → query agregasi (`count`, `sum(durasi)`) dengan filter `bulan_lembur` / `tanggal_*`.

---

## 8. Keamanan & RLS

- Karena berbagi DB, pastikan **RLS tidak memblokir** akses HR.
- Opsi: gunakan role `hr`/`admin` di `master_data.role` + policy, atau Supabase Auth dengan JWT role.
- Jangan pernah mengekspos `service_role key` di client; gunakan `anon key` + RLS.

---

## 9. Checklist Implementasi (urutan)

1. Konfirmasi 4 keputusan §4.
2. Scaffold Vite project (`hr-dashboard/`).
3. Setup `supabase.js` (env shared).
4. `authStore` + `Login.jsx`.
5. `Layout.jsx` (sidebar/nav) + routing `App.jsx`.
6. `Dashboard.jsx` (statistik).
7. `Karyawan.jsx` (CRUD).
8. `ApprovalIzin.jsx` + `ApprovalLembur.jsx` (status update + badge).
9. `Rekap.jsx` (agregasi + export opsional).
10. Styling konsisten (reuse theme token).
11. Uji alur end-to-end + verifikasi nama kolom DB aktual.


> ⚠️ Ada inkonsistensi nama kolom antara kode React baru (`tanggal_izin_mulai` / `tanggal_izin_akhir` / `kategori_izin`) dan legacy HTML. Saat implementasi wajib **verifikasi nama kolom aktual** lewat Supabase Table Editor sebelum menulis query.

### Nilai `status` (mapping badge — dipertahankan dari legacy)
| Status | Label | Warna badge |
|---|---|---|
| `PENDING` | Menunggu | Kuning |
| `DISETUJUI` | Disetujui | Hijau |
| `DITOLAK` | Ditolak | Merah |
