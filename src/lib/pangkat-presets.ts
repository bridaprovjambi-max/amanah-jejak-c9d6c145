export const PANGKAT_PRESETS = [
  "IVa / Pembina",
  "IVb / Pembina Tingkat I",
  "IVc / Pembina Muda",
  "IVd / Pembina Madya",
  "IVe / Pembina Utama",
  "IIIa / Penata Muda",
  "IIIb / Penata Muda Tingkat I",
  "IIIc / Penata",
  "IIId / Penata Tingkat I",
  "IIa / Pengatur Muda",
  "IIb / Pengatur Muda Tingkat I",
  "IIc / Pengatur",
  "IId / Pengatur Tingkat I",
] as const;

export type PangkatPreset = (typeof PANGKAT_PRESETS)[number];
