export const JABATAN_PRESETS = [
  "Kepala BRIDA",
  "Sekretaris BRIDA",
  "Kasubbag Umum dan Kepegawaian",
  "Peneliti Madya",
  "Peneliti Muda",
  "Peneliti Pertama",
  "Perencana Madya",
  "Perencana Muda",
  "Perencana Pertama",
  "Analis Kebijakan Madya",
  "Analis Kebijakan Muda",
  "Analis Kebijakan Pertama",
  "Arsiparis Madya",
  "Arsiparis Muda",
  "Arsiparis Pertama",
  "Analis Data Ilmiah Madya",
  "Analis Data Ilmiah Muda",
  "Analis Data Ilmiah Pertama",
  "Penelaah Teknis Kebijakan",
] as const;

export type JabatanPreset = (typeof JABATAN_PRESETS)[number];
