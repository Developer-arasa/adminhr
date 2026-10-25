-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.master_data (
  id_karyawan character varying NOT NULL,
  nama_karyawan character varying NOT NULL,
  pin character varying DEFAULT '123456'::character varying,
  role character varying DEFAULT 'karyawan'::character varying,
  nik_ktp character varying,
  jabatan character varying,
  departemen character varying,
  tgl_gabung date,
  tempat_lahir character varying,
  tgl_lahir date,
  no_hp character varying,
  alamat_domisili text,
  status_nikah character varying,
  jatah_cuti integer DEFAULT 12,
  kontak_darurat character varying,
  CONSTRAINT master_data_pkey PRIMARY KEY (id_karyawan)
);
CREATE TABLE public.data_izin (
  id integer NOT NULL DEFAULT nextval('data_izin_id_seq'::regclass),
  created_at timestamp without time zone DEFAULT now(),
  id_karyawan character varying,
  nama character varying NOT NULL,
  tanggal_izin_mulai date NOT NULL,
  tanggal_izin_akhir date NOT NULL,
  kategori_izin character varying NOT NULL,
  alasan text,
  status character varying DEFAULT 'PENDING'::character varying,
  CONSTRAINT data_izin_pkey PRIMARY KEY (id)
);
CREATE TABLE public.data_lembur (
  id integer NOT NULL DEFAULT nextval('data_lembur_id_seq'::regclass),
  created_at timestamp without time zone DEFAULT now(),
  id_karyawan character varying,
  nama character varying NOT NULL,
  tanggal_lembur date NOT NULL,
  jam_awal time without time zone NOT NULL,
  jam_selesai time without time zone NOT NULL,
  durasi numeric NOT NULL,
  alasan text,
  bulan_lembur character varying NOT NULL,
  status character varying DEFAULT 'PENDING'::character varying,
  CONSTRAINT data_lembur_pkey PRIMARY KEY (id)
);
CREATE TABLE public.data_pengumuman (
  id integer NOT NULL DEFAULT nextval('data_pengumuman_id_seq'::regclass),
  judul character varying NOT NULL,
  isi_pesan text,
  tanggal date DEFAULT CURRENT_DATE,
  label_kategori character varying DEFAULT 'Info'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT data_pengumuman_pkey PRIMARY KEY (id)
);