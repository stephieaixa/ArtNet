export type Discipline = {
  id: string;
  label: string;
  category: string; // agrupación visual en onboarding/filtros
  genre: string;    // filtro genérico (aerial, floor, manipulation, fire, led, clown, equilibrium)
};

export type DisciplineGenre = {
  id: string;
  label: string;
  emoji: string;
};

// Filtros genéricos — nivel alto
export const DISCIPLINE_GENRES: DisciplineGenre[] = [
  { id: 'aerial',       label: 'Acrobacia Aérea',   emoji: '🎪' },
  { id: 'floor',        label: 'Acrobacia de Piso',  emoji: '🤸' },
  { id: 'manipulation', label: 'Manipulación',        emoji: '🤹' },
  { id: 'fire',         label: 'Fuego',               emoji: '🔥' },
  { id: 'led',          label: 'LED / Luminoso',      emoji: '💡' },
  { id: 'clown',        label: 'Clown & Comedia',     emoji: '🤡' },
  { id: 'equilibrium',  label: 'Equilibrismo',        emoji: '🎯' },
  { id: 'character',    label: 'Personaje & Calle',   emoji: '🎭' },
  { id: 'production',   label: 'Producción',          emoji: '🎬' },
];

export const DISCIPLINES: Discipline[] = [
  // ── Aéreo ──────────────────────────────────────────────
  { id: 'aerial_silk',    label: 'Tela',                     category: 'Aéreo',          genre: 'aerial' },
  { id: 'aerial_hoop',    label: 'Aro / Lyra',               category: 'Aéreo',          genre: 'aerial' },
  { id: 'aerial_trapeze', label: 'Trapecio',                 category: 'Aéreo',          genre: 'aerial' },
  { id: 'aerial_straps',  label: 'Cintas',                   category: 'Aéreo',          genre: 'aerial' },
  { id: 'aerial_rope',    label: 'Cuerda / Cuerda Lisa',     category: 'Aéreo',          genre: 'aerial' },
  { id: 'aerial_cube',    label: 'Cubo Aéreo',               category: 'Aéreo',          genre: 'aerial' },
  { id: 'chinese_pole',   label: 'Palo Chino',               category: 'Aéreo',          genre: 'aerial' },
  { id: 'russian_bar',    label: 'Barra Rusa',               category: 'Aéreo',          genre: 'aerial' },

  // ── Acrobacia de Piso ──────────────────────────────────
  { id: 'acrobatics',         label: 'Acrobacia',             category: 'Acrobacia de Piso', genre: 'floor' },
  { id: 'partner_acrobatics', label: 'Acrobacia Dúo / Portor', category: 'Acrobacia de Piso', genre: 'floor' },
  { id: 'contortion',         label: 'Contorsionismo',        category: 'Acrobacia de Piso', genre: 'floor' },
  { id: 'hand_balance',       label: 'Verticalista',          category: 'Acrobacia de Piso', genre: 'floor' },
  { id: 'banquine',           label: 'Banquina',              category: 'Acrobacia de Piso', genre: 'floor' },
  { id: 'teeterboard',        label: 'Balancín / Trampolín',  category: 'Acrobacia de Piso', genre: 'floor' },
  { id: 'wheel_of_death',     label: 'Rueda de la Muerte',    category: 'Acrobacia de Piso', genre: 'floor' },
  { id: 'rola_bola',          label: 'Rola Bola',             category: 'Acrobacia de Piso', genre: 'floor' },
  { id: 'cyr_wheel',          label: 'Rueda Cyr / German Wheel', category: 'Acrobacia de Piso', genre: 'floor' },

  // ── Manipulación ──────────────────────────────────────
  { id: 'juggling',  label: 'Malabares',      category: 'Manipulación', genre: 'manipulation' },
  { id: 'poi',       label: 'Poi',            category: 'Manipulación', genre: 'manipulation' },
  { id: 'staff',     label: 'Staff / Bastón', category: 'Manipulación', genre: 'manipulation' },
  { id: 'hula_hoop', label: 'Hula Hoop',      category: 'Manipulación', genre: 'manipulation' },
  { id: 'diabolo',   label: 'Diábolo',        category: 'Manipulación', genre: 'manipulation' },
  { id: 'kendama',   label: 'Kendama / Yo-yo', category: 'Manipulación', genre: 'manipulation' },

  // ── Fuego ─────────────────────────────────────────────
  { id: 'fire_poi',      label: 'Poi de Fuego',          category: 'Fuego', genre: 'fire' },
  { id: 'fire_staff',    label: 'Staff de Fuego',        category: 'Fuego', genre: 'fire' },
  { id: 'fire_juggling', label: 'Malabares con Fuego',   category: 'Fuego', genre: 'fire' },
  { id: 'fire_hoop',     label: 'Hula Hoop de Fuego',   category: 'Fuego', genre: 'fire' },
  { id: 'fire_eating',   label: 'Tragafuegos',           category: 'Fuego', genre: 'fire' },

  // ── LED & Luminoso ────────────────────────────────────
  { id: 'led_poi',   label: 'Poi LED',               category: 'LED & Luminoso', genre: 'led' },
  { id: 'led_staff', label: 'Staff LED',             category: 'LED & Luminoso', genre: 'led' },
  { id: 'led_hoop',  label: 'Hula Hoop LED',         category: 'LED & Luminoso', genre: 'led' },
  { id: 'led_suit',  label: 'Traje LED',             category: 'LED & Luminoso', genre: 'led' },
  { id: 'led_show',  label: 'Show LED / Luminoso',   category: 'LED & Luminoso', genre: 'led' },
  { id: 'glow',      label: 'Glow / Neón',           category: 'LED & Luminoso', genre: 'led' },

  // ── Equilibrismo ──────────────────────────────────────
  { id: 'tightrope', label: 'Cuerda Floja / Slackline', category: 'Equilibrismo', genre: 'equilibrium' },
  { id: 'unicycle',  label: 'Monociclo',                category: 'Equilibrismo', genre: 'equilibrium' },

  // ── Clown & Comedia ───────────────────────────────────
  { id: 'clown',          label: 'Clown',           category: 'Clown & Comedia', genre: 'clown' },
  { id: 'mime',           label: 'Mimo',            category: 'Clown & Comedia', genre: 'clown' },
  { id: 'bouffon',        label: 'Bufón / Bouffon', category: 'Clown & Comedia', genre: 'clown' },
  { id: 'physical_comedy', label: 'Comedia Física', category: 'Clown & Comedia', genre: 'clown' },

  // ── Personaje & Calle ─────────────────────────────────
  { id: 'stilt_walking', label: 'Zancos',                category: 'Personaje & Calle', genre: 'character' },
  { id: 'living_statue', label: 'Estatua Viviente',      category: 'Personaje & Calle', genre: 'character' },
  { id: 'street_show',   label: 'Espectáculo Callejero', category: 'Personaje & Calle', genre: 'character' },

  // ── Producción ────────────────────────────────────────
  { id: 'spectacle_direction', label: 'Dirección de Espectáculos', category: 'Producción', genre: 'production' },
  { id: 'choreography',        label: 'Coreografía',               category: 'Producción', genre: 'production' },
  { id: 'stage_management',    label: 'Producción / Stage Manager', category: 'Producción', genre: 'production' },
];

export const DISCIPLINE_CATEGORIES = [...new Set(DISCIPLINES.map(d => d.category))];

export const getDisciplineLabel = (id: string) =>
  DISCIPLINES.find(d => d.id === id)?.label ?? id;

// Devuelve todos los ids de disciplina que pertenecen a un género
export const getDisciplinesByGenre = (genreId: string): string[] =>
  DISCIPLINES.filter(d => d.genre === genreId).map(d => d.id);
