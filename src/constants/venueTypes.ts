export type VenueType = {
  id: string;
  label: string;
  emoji: string;
};

export const VENUE_TYPES: VenueType[] = [
  { id: 'cruise_ship', label: 'Crucero', emoji: '🚢' },
  { id: 'hotel', label: 'Hotel / Resort', emoji: '🏨' },
  { id: 'festival', label: 'Festival', emoji: '🎪' },
  { id: 'circus', label: 'Circo', emoji: '🎡' },
  { id: 'amusement_park', label: 'Parque de Diversiones', emoji: '🎢' },
  { id: 'production_company', label: 'Productora', emoji: '🎬' },
  { id: 'theater', label: 'Teatro / Sala', emoji: '🎭' },
  { id: 'casino', label: 'Casino', emoji: '🎰' },
  { id: 'corporate', label: 'Eventos Corporativos', emoji: '🏢' },
  { id: 'dinner_show', label: 'Dinner Show', emoji: '🍷' },
  { id: 'agency', label: 'Agencia de Artistas', emoji: '📋' },
  { id: 'competition', label: 'Competencia', emoji: '🏆' },
  { id: 'other', label: 'Otro', emoji: '🎶' },
];

export const CONTRACT_TYPES = [
  { id: 'full_time', label: 'Tiempo Completo' },
  { id: 'part_time', label: 'Medio Tiempo' },
  { id: 'seasonal', label: 'Temporada' },
  { id: 'residency', label: 'Residencia' },
  { id: 'one_off', label: 'Show Puntual' },
  { id: 'tour', label: 'Gira / Tour' },
];

export const PAY_TYPES = [
  { id: 'hourly', label: 'Por Hora' },
  { id: 'per_show', label: 'Por Show' },
  { id: 'daily', label: 'Por Día' },
  { id: 'weekly', label: 'Por Semana' },
  { id: 'monthly', label: 'Por Mes' },
  { id: 'negotiable', label: 'A Convenir' },
];
