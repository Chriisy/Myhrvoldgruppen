// Norwegian labels for all enums and statuses

// User roles
export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  leader: 'Leder',
  service: 'Serviceleder',
  technician: 'Tekniker',
  installer: 'Montor',
  sales: 'Salg',
  viewer: 'Leser',
};

// Claim status
export const CLAIM_STATUS_LABELS: Record<string, string> = {
  open: 'Apen',
  in_progress: 'Under behandling',
  waiting_supplier: 'Venter pa leverandor',
  waiting_parts: 'Venter pa deler',
  waiting_customer: 'Venter pa kunde',
  resolved: 'Lost',
  closed: 'Lukket',
  rejected: 'Avvist',
};

// Visit status
export const VISIT_STATUS_LABELS: Record<string, string> = {
  planned: 'Planlagt',
  confirmed: 'Bekreftet',
  in_progress: 'Pagar',
  completed: 'Fullfort',
  cancelled: 'Kansellert',
};

// Visit type
export const VISIT_TYPE_LABELS: Record<string, string> = {
  scheduled: 'Planlagt service',
  emergency: 'Akutt',
  installation: 'Installasjon',
  inspection: 'Inspeksjon',
};

// Agreement status
export const AGREEMENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  active: 'Aktiv',
  expired: 'Utlopt',
  cancelled: 'Kansellert',
};

// Customer segment
export const CUSTOMER_SEGMENT_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  hotel: 'Hotell',
  catering: 'Catering',
  institution: 'Institusjon',
  retail: 'Detaljhandel',
  other: 'Annet',
};

// Supplier category
export const SUPPLIER_CATEGORY_LABELS: Record<string, string> = {
  refrigeration: 'Kjol/Frys',
  cooking: 'Koking',
  dishwashing: 'Oppvask',
  ventilation: 'Ventilasjon',
  furniture: 'Inventar',
  smallware: 'Smarekvisita',
  other: 'Annet',
};

// Product category
export const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  refrigerator: 'Kjoleskap',
  freezer: 'Fryser',
  oven: 'Ovn',
  stove: 'Komfyr',
  dishwasher: 'Oppvaskmaskin',
  hood: 'Avtrekkshette',
  ice_machine: 'Ismaskin',
  coffee_machine: 'Kaffemaskin',
  other: 'Annet',
};

// Priority
export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Lav',
  normal: 'Normal',
  high: 'Hoy',
  urgent: 'Kritisk',
};

// Installation status
export const INSTALLATION_STATUS_LABELS: Record<string, string> = {
  planned: 'Planlagt',
  in_progress: 'Under arbeid',
  on_hold: 'Pa vent',
  completed: 'Fullfort',
  cancelled: 'Kansellert',
};

// HMS/SJA risk levels
export const RISK_LEVEL_LABELS: Record<string, string> = {
  low: 'Lav risiko',
  medium: 'Middels risiko',
  high: 'Hoy risiko',
};

// Loan status
export const LOAN_STATUS_LABELS: Record<string, string> = {
  active: 'Aktivt utlan',
  returned: 'Returnert',
  overdue: 'Forfalt',
};

// Equipment condition
export const EQUIPMENT_CONDITION_LABELS: Record<string, string> = {
  excellent: 'Utmerket',
  good: 'God',
  fair: 'OK',
  poor: 'Darlig',
};

// Sales opportunity stage
export const SALES_STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualification: 'Kvalifisering',
  proposal: 'Tilbud',
  negotiation: 'Forhandling',
  won: 'Vunnet',
  lost: 'Tapt',
};

// Stinker severity
export const STINKER_SEVERITY_LABELS: Record<string, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Hoy',
  critical: 'Kritisk',
};

// Forum category
export const FORUM_CATEGORY_LABELS: Record<string, string> = {
  general: 'Generelt',
  technical: 'Teknisk',
  news: 'Nyheter',
  help: 'Hjelp',
};

// Chat channel type
export const CHAT_CHANNEL_TYPE_LABELS: Record<string, string> = {
  group: 'Gruppe',
  direct: 'Direktemelding',
  announcement: 'Kunngjoring',
};

// Days of week
export const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Sondag',
  1: 'Mandag',
  2: 'Tirsdag',
  3: 'Onsdag',
  4: 'Torsdag',
  5: 'Fredag',
  6: 'Lordag',
};

// Months
export const MONTH_LABELS: Record<number, string> = {
  0: 'Januar',
  1: 'Februar',
  2: 'Mars',
  3: 'April',
  4: 'Mai',
  5: 'Juni',
  6: 'Juli',
  7: 'August',
  8: 'September',
  9: 'Oktober',
  10: 'November',
  11: 'Desember',
};
