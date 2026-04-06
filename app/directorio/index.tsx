import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ScrollView, Linking, Clipboard, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { COLORS, FONTS, SPACING, RADIUS, HEADER_TOP } from '../../src/constants/theme';
import { VENUE_TYPES } from '../../src/constants/venueTypes';
import { DISCIPLINES } from '../../src/constants/disciplines';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/services/supabase';

type Contact = {
  id: string;
  name: string;
  venue_type: string;
  country: string;
  region: string;
  description: string;
  contact_name?: string;
  contact_title?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  disciplines: string[];
  verified: boolean;
  how_to_apply?: string;
};

const DIRECTORY: Contact[] = [
  {
    id: 'd1', name: 'MSC Cruceros — Casting', venue_type: 'cruise_ship',
    country: 'Italia', region: 'Europa',
    description: 'División de entretenimiento de MSC Cruceros. Buscan artistas para sus barcos en rutas mediterráneas, caribeñas y del norte de Europa.',
    contact_name: 'Entertainment Casting Dept.', contact_title: 'Casting Director',
    email: 'entertainment.casting@msc.com', website: 'https://www.msc.com',
    disciplines: ['aerial_silk', 'aerial_hoop', 'acrobatics', 'singing', 'dancing'],
    verified: true,
    how_to_apply: 'Enviá CV artístico + video de audición (máx. 5 min) al email de casting.',
  },
  {
    id: 'd2', name: 'Cirque du Soleil — Casting', venue_type: 'circus',
    country: 'Canadá', region: 'América del Norte',
    description: 'El circo contemporáneo más grande del mundo. Convocan artistas de alto nivel para sus producciones en Las Vegas, Broadway y giras mundiales.',
    contact_name: 'Casting Team', contact_title: 'Artists & Casting',
    website: 'https://www.cirquedusoleil.com/casting',
    disciplines: ['aerial_silk', 'contortion', 'hand_balance', 'acrobatics', 'clown'],
    verified: true,
    how_to_apply: 'Completá el formulario online en su web de casting. Incluí video de máximo 3 minutos mostrando tu mejor habilidad.',
  },
  {
    id: 'd3', name: 'Festival Mondial du Cirque de Demain', venue_type: 'festival',
    country: 'Francia', region: 'Europa',
    description: 'Uno de los festivales de circo más prestigiosos del mundo, en París. Seleccionan jóvenes artistas emergentes de todas las disciplinas circenses.',
    contact_name: 'Marie Dupont', contact_title: 'Directora Artística',
    website: 'https://www.cirquedeademain.com',
    disciplines: ['aerial_silk', 'juggling', 'acrobatics', 'contortion', 'clown'],
    verified: true,
    how_to_apply: 'Inscripción anual en septiembre via formulario online. Se requiere video + dossier artístico completo.',
  },
  {
    id: 'd4', name: 'Royal Caribbean — Entertainment', venue_type: 'cruise_ship',
    country: 'Estados Unidos', region: 'América del Norte',
    description: 'División de entretenimiento de Royal Caribbean. Producen espectáculos Broadway-style y contratan artistas individuales para sus cruceros de lujo.',
    contact_name: 'Fleet Entertainment', contact_title: 'Entertainment Coordinator',
    email: 'fleetentertainment@rccl.com', website: 'https://www.royalcaribbean.com',
    disciplines: ['singing', 'dancing', 'acrobatics', 'aerial_silk'],
    verified: true,
    how_to_apply: 'Audiciones abiertas en distintas ciudades. Seguí su página de casting para fechas.',
  },
  {
    id: 'd5', name: 'Festival Internacional de Circo de Monte Carlo', venue_type: 'festival',
    country: 'Mónaco', region: 'Europa',
    description: 'El festival de circo más antiguo y prestigioso del mundo, fundado por el Príncipe Rainiero III en 1974. Festival de competición con el Clown de Oro.',
    contact_name: 'Arlette Gruss', contact_title: 'Directora',
    website: 'https://www.montecarlofestival.mc',
    disciplines: ['acrobatics', 'juggling', 'aerial_silk', 'hand_balance', 'clown'],
    verified: true,
    how_to_apply: 'Inscripción via web oficial antes de mayo de cada año. Se requiere video HD del número completo.',
  },
  {
    id: 'd6', name: 'Lido de Paris', venue_type: 'theater',
    country: 'Francia', region: 'Europa',
    description: 'Histórico cabaret parisino en los Campos Elíseos. Producen espectáculos de revista con artistas de varieté, danza y circo.',
    contact_name: 'Dirección Artística', contact_title: 'Casting Manager',
    email: 'casting@lido.fr', website: 'https://www.lido.fr',
    disciplines: ['dancing', 'aerial_silk', 'acrobatics', 'singing'],
    verified: true,
    how_to_apply: 'Enviá dossier completo con fotos, video y CV artístico al email de casting.',
  },
  {
    id: 'd7', name: 'Circo Atayde Hermanos', venue_type: 'circus',
    country: 'México', region: 'América Latina',
    description: 'El circo más antiguo de México y uno de los más reconocidos de Latinoamérica. Realizan giras por todo México y Centroamérica.',
    contact_name: 'Producción Artística', contact_title: 'Director',
    facebook: 'https://www.facebook.com/CircoAtaydeHermanos',
    disciplines: ['acrobatics', 'juggling', 'clown', 'aerial_silk', 'unicycle'],
    verified: false,
    how_to_apply: 'Contactá via Facebook o Instagram presentando tu material audiovisual.',
  },
  {
    id: 'd8', name: 'Roncalli Circus', venue_type: 'circus',
    country: 'Alemania', region: 'Europa',
    description: 'Circo de alta gama alemán conocido por sus producciones de calidad artística excepcional. Gira por toda Europa.',
    contact_name: 'Bernhard Paul', contact_title: 'Director Artístico',
    website: 'https://www.roncalli.de',
    email: 'casting@roncalli.de',
    disciplines: ['acrobatics', 'clown', 'aerial_silk', 'hand_balance', 'juggling'],
    verified: true,
    how_to_apply: 'Enviá dossier completo por email. Incluí video del número completo, fotos técnicas y referencias.',
  },
  {
    id: 'd9', name: 'Costa Cruceros — Entretenimiento', venue_type: 'cruise_ship',
    country: 'Italia', region: 'Europa',
    description: 'Costa Cruceros busca artistas para sus barcos que navegan por el Mediterráneo, Caribe y Asia. Shows nightly + animación de día.',
    email: 'entertainment@costacruises.com', website: 'https://www.costacruises.com',
    disciplines: ['dancing', 'singing', 'aerial_silk', 'acrobatics'],
    verified: true,
    how_to_apply: 'Formulario de aplicación online en su web de empleos + video de audición.',
  },
  {
    id: 'd10', name: 'Festival de Circo de Toulouse', venue_type: 'festival',
    country: 'Francia', region: 'Europa',
    description: 'Festival internacional de circo contemporáneo en Toulouse. Seleccionan compañías y artistas emergentes para funciones y residencias artísticas.',
    website: 'https://www.cirquetoulouse.com',
    disciplines: ['acrobatics', 'aerial_silk', 'clown', 'contemporary_dance'],
    verified: false,
    how_to_apply: 'Inscripción anual via formulario online. Se valoran propuestas originales e innovadoras.',
  },
  {
    id: 'd11', name: 'Dragone Productions', venue_type: 'production_company',
    country: 'Bélgica', region: 'Europa',
    description: 'Productora de espectáculos de gran formato (ex-creador de shows de Cirque du Soleil). Producen shows residenciales en Macao, Dubai y Las Vegas.',
    website: 'https://www.dragone.com',
    email: 'casting@dragone.com',
    disciplines: ['aerial_silk', 'acrobatics', 'contortion', 'dancing', 'hand_balance'],
    verified: true,
    how_to_apply: 'Enviá aplicación completa via web. Proceso de selección riguroso con múltiples rondas.',
  },
  {
    id: 'd12', name: 'Club Med — Entretenimiento', venue_type: 'hotel',
    country: 'Francia', region: 'Global',
    description: 'Club Med busca artistas y animadores para sus resorts en todo el mundo: Maldivas, Caribe, Europa, Asia. Contratos de 6-12 meses.',
    website: 'https://www.clubmed.jobs',
    disciplines: ['dancing', 'acrobatics', 'singing', 'circus', 'aerial_silk'],
    verified: true,
    how_to_apply: 'Postulate directamente en clubmed.jobs. Incluí video de presentación y CV.',
  },

  // ─── MÁS CRUCEROS ─────────────────────────────────────────────────────────
  {
    id: 'd13', name: 'Norwegian Cruise Line — Entertainment', venue_type: 'cruise_ship',
    country: 'Estados Unidos', region: 'América del Norte',
    description: 'NCL produce shows de alta energía en sus barcos. Contratan acróbatas, bailarines, cantantes y artistas de variedades para giras de 4-6 meses.',
    email: 'entertainmentcasting@ncl.com', website: 'https://www.ncl.com/careers/entertainment',
    disciplines: ['acrobatics', 'aerial_silk', 'dancing', 'singing', 'hand_balance'],
    verified: true,
    how_to_apply: 'Postulate online en su portal de empleos. Video de audición obligatorio.',
  },
  {
    id: 'd14', name: 'Disney Cruise Line — Casting', venue_type: 'cruise_ship',
    country: 'Estados Unidos', region: 'América del Norte',
    description: 'Disney Cruise Line busca artistas para sus shows temáticos a bordo. Alta competencia pero excelentes condiciones laborales.',
    website: 'https://disneycruiselinecastingcallonline.com',
    disciplines: ['acrobatics', 'dancing', 'singing', 'aerial_silk', 'acting'],
    verified: true,
    how_to_apply: 'Audiciones abiertas en distintas ciudades. Revisá su web para fechas y requisitos.',
  },
  {
    id: 'd15', name: 'Celebrity Cruises — Entertainment', venue_type: 'cruise_ship',
    country: 'Estados Unidos', region: 'América del Norte',
    description: 'Celebrity Cruises produce shows contemporáneos de alta gama. Buscan artistas versátiles para contratos de 5-7 meses.',
    email: 'entertainment@celebrity.com', website: 'https://www.celebrity-entertainment.com',
    disciplines: ['acrobatics', 'aerial_silk', 'dancing', 'singing'],
    verified: true,
    how_to_apply: 'Enviá CV artístico + video al email de casting.',
  },
  {
    id: 'd16', name: 'Carnival Corporation — Entertainment', venue_type: 'cruise_ship',
    country: 'Estados Unidos', region: 'América del Norte',
    description: 'Empresa matriz de Carnival, Princess, Holland America, P&O y otras líneas. Contratan artistas para múltiples flotas.',
    website: 'https://www.carnivalcorp.com/careers',
    disciplines: ['dancing', 'singing', 'acrobatics', 'aerial_silk'],
    verified: true,
    how_to_apply: 'Portal de empleos centralizado para todas las líneas del grupo.',
  },

  // ─── PARQUES TEMÁTICOS ─────────────────────────────────────────────────────
  {
    id: 'd17', name: 'Disney Parks & Resorts — Entertainment', venue_type: 'theme_park',
    country: 'Estados Unidos', region: 'Global',
    description: 'Disney Parks contrata artistas para sus parques en Orlando, Anaheim, París, Tokio, Hong Kong y Shanghái. Shows en vivo + desfiles.',
    website: 'https://jobs.disneycareers.com/entertainment-auditions',
    disciplines: ['acrobatics', 'dancing', 'singing', 'stilt_walking', 'acting'],
    verified: true,
    how_to_apply: 'Audiciones abiertas en distintas ciudades. Ver calendario en su web.',
  },
  {
    id: 'd18', name: 'Universal Studios — Entertainment', venue_type: 'theme_park',
    country: 'Estados Unidos', region: 'Global',
    description: 'Universal Studios contrata artistas para sus parques en Orlando, Hollywood, Osaka, Singapur y Beijing. Shows de acción y espectáculos en vivo.',
    website: 'https://www.universalcreativecasting.com',
    disciplines: ['acrobatics', 'stunt', 'acting', 'dancing', 'stilt_walking'],
    verified: true,
    how_to_apply: 'Audiciones anuales. Revisá su web de casting para convocatorias activas.',
  },
  {
    id: 'd19', name: 'Ferrari World / Yas Theme Parks — Abu Dhabi', venue_type: 'theme_park',
    country: 'Emiratos Árabes', region: 'Medio Oriente',
    description: 'Grupo de parques temáticos en Abu Dhabi: Ferrari World, Warner Bros. World, SeaWorld. Buscan artistas para shows en vivo con condiciones tax-free.',
    website: 'https://www.yasthemeparks.com/en/careers',
    disciplines: ['acrobatics', 'stunt', 'acting', 'dancing'],
    verified: true,
    how_to_apply: 'Portal de empleos online. Condiciones muy competitivas, salario libre de impuestos.',
  },

  // ─── COMPAÑÍAS DE PRODUCCIÓN ───────────────────────────────────────────────
  {
    id: 'd20', name: 'Spiegelworld — Casting', venue_type: 'production_company',
    country: 'Estados Unidos', region: 'América del Norte',
    description: 'Productora de shows de cabaret/circo de vanguardia. Producciones en Las Vegas (Absinthe), NYC (Empire) y otros. Estilo irreverente, adulto y de alta calidad.',
    website: 'https://spiegelworld.com/casting',
    email: 'casting@spiegelworld.com',
    disciplines: ['acrobatics', 'aerial_silk', 'contortion', 'clown', 'aerial_trapeze'],
    verified: true,
    how_to_apply: 'Enviá video + CV a su email de casting. Buscan artistas con personalidad fuerte.',
  },
  {
    id: 'd21', name: 'Les 7 Doigts de la Main', venue_type: 'production_company',
    country: 'Canadá', region: 'América del Norte',
    description: 'Compañía de circo contemporáneo fundada en Montréal en 2002. Conocidos por su estilo íntimo y narrativo, mezclan circo, danza y teatro. Han trabajado en Broadway (Traces, Cuisine & Confessions), Netflix y giras por 40+ países. Una de las compañías más influyentes del circo contemporáneo mundial.',
    website: 'https://7fingers.com', contact_name: 'Casting — Les 7 Doigts',
    email: 'casting@7fingers.com', instagram: 'https://www.instagram.com/les7doigts',
    disciplines: ['aerial_silk', 'aerial_hoop', 'hand_balance', 'contortion', 'acrobatics', 'juggling', 'dancing', 'partner_acrobatics'],
    verified: true,
    how_to_apply: 'Enviá dossier artístico + video en formato link (YouTube/Vimeo). Buscan artistas con habilidades múltiples, personalidad escénica y perfil actoral. Formulario en 7fingers.com.',
  },
  {
    id: 'd22', name: 'VStar Entertainment Group', venue_type: 'production_company',
    country: 'Estados Unidos', region: 'América del Norte',
    description: 'Productora de tours y shows familiares. Producen shows de Cirque Dreams, Disney on Ice y otros. Contratos de gira por EE.UU. y Canadá.',
    website: 'https://www.vstarlive.com/casting',
    disciplines: ['acrobatics', 'aerial_silk', 'skating', 'dancing'],
    verified: true,
    how_to_apply: 'Audiciones periódicas. Ver convocatorias en su web.',
  },
  {
    id: 'd23', name: 'Cirque Dreams — Casting', venue_type: 'production_company',
    country: 'Estados Unidos', region: 'América del Norte',
    description: 'Productora de shows de circo contemporáneo para Broadway, cruceros y giras. Estilo único que combina circo, acrobacia y efectos especiales.',
    website: 'https://cirquedreams.com/casting',
    email: 'casting@cirquedreams.com',
    disciplines: ['aerial_silk', 'acrobatics', 'contortion', 'hand_balance', 'aerial_hoop'],
    verified: true,
    how_to_apply: 'Enviá video de 3-5 min + CV a casting@cirquedreams.com',
  },
  {
    id: 'd24', name: 'Cavalia / Odysseo — Casting', venue_type: 'production_company',
    country: 'Canadá', region: 'Global',
    description: 'Espectáculos de gran formato con caballos y artistas. Shows residenciales y en gira por todo el mundo. Circo ecuestre de alto nivel.',
    website: 'https://www.cavalia.com/casting',
    disciplines: ['acrobatics', 'aerial_silk', 'hand_balance', 'contortion', 'partner_acrobatics'],
    verified: true,
    how_to_apply: 'Convocatorias periódicas en su web. Video de audición + foto de cuerpo completo.',
  },

  // ─── MÁS FESTIVALES ───────────────────────────────────────────────────────
  {
    id: 'd25', name: 'Festival CIRCA — Toulouse', venue_type: 'festival',
    country: 'Francia', region: 'Europa',
    description: 'Festival europeo de circo contemporáneo de referencia. Cada año en octubre en Auch. Seleccionan compañías emergentes y confirmadas de todo el mundo.',
    website: 'https://www.circa.auch.fr/appel-a-projets',
    disciplines: ['aerial_silk', 'juggling', 'acrobatics', 'contortion', 'clown', 'hand_balance'],
    verified: true,
    how_to_apply: 'Convocatoria anual en enero. Dossier artístico + video de la propuesta completa.',
  },
  {
    id: 'd26', name: 'SIPAM — Festival Int. del Circo', venue_type: 'festival',
    country: 'España', region: 'Europa',
    description: 'Salón Internacional del Ocio y las Artes Escénicas. Referencia para artistas y compañías en España. Plataforma de negocios y difusión.',
    website: 'https://www.sipam.es',
    disciplines: ['acrobatics', 'clown', 'juggling', 'aerial_silk', 'stilt_walking'],
    verified: true,
    how_to_apply: 'Inscripción anual como artista o compañía. Ver convocatorias en su web.',
  },
  {
    id: 'd27', name: 'Festival de Circo de Cataluña (FICC)', venue_type: 'festival',
    country: 'España', region: 'Europa',
    description: 'Festival Internacional de Circo de Catalunya en Girona. Concurso para compañías jóvenes y artistas emergentes de todas las disciplinas circenses.',
    website: 'https://www.ficc.cat/convocatoria',
    disciplines: ['acrobatics', 'aerial_silk', 'juggling', 'clown', 'hand_balance'],
    verified: true,
    how_to_apply: 'Inscripción online antes de junio. Incluir video del número (máx 8 min) + dossier.',
  },
  {
    id: 'd28', name: 'Cirque de Demain — Festival', venue_type: 'festival',
    country: 'Francia', region: 'Europa',
    description: 'Festival Mondial du Cirque de Demain en París — el más importante para artistas jóvenes. Ganadores obtienen visibilidad mundial y contratos.',
    website: 'https://www.festival-demain.com',
    email: 'info@festival-demain.com',
    disciplines: ['aerial_silk', 'acrobatics', 'juggling', 'contortion', 'hand_balance', 'clown'],
    verified: true,
    how_to_apply: 'Inscripción en septiembre cada año. Video HD del número + formulario online.',
  },
  {
    id: 'd29', name: 'International Circus Festival — Budapest', venue_type: 'festival',
    country: 'Hungría', region: 'Europa',
    description: 'Festival internacional de circo en Budapest. Competición con premios y visibilidad para artistas de todo el mundo.',
    website: 'https://www.fesztivaIcirkusz.hu',
    disciplines: ['acrobatics', 'aerial_silk', 'juggling', 'hand_balance', 'contortion'],
    verified: false,
    how_to_apply: 'Inscripción via web antes de marzo. Video del número completo requerido.',
  },
  {
    id: 'd30', name: 'Glastonbury Festival — Circus Arts', venue_type: 'festival',
    country: 'Reino Unido', region: 'Europa',
    description: 'El festival de música más icónico del mundo tiene una sección completa de artes circenses. Contratan artistas individuales y compañías para el campo Circo.',
    website: 'https://www.glastonburyfestivals.co.uk/information/performers',
    disciplines: ['juggling', 'stilt_walking', 'fire_dance', 'acrobatics', 'clown', 'aerial_silk'],
    verified: true,
    how_to_apply: 'Convocatoria anual en diciembre. Formulario online para artistas callejeros y de circo.',
  },

  // ─── HOTELES Y RESORTS ──────────────────────────────────────────────────────
  {
    id: 'd31', name: 'Sandals Resorts — Entertainment', venue_type: 'hotel',
    country: 'Jamaica', region: 'América del Norte',
    description: 'Cadena de resorts all-inclusive premium en el Caribe. Contratan animadores y artistas para shows nocturnos y actividades diurnas. Contratos de 6 meses.',
    website: 'https://www.sandals.com/careers',
    disciplines: ['dancing', 'singing', 'acrobatics', 'aerial_silk', 'fire_dance'],
    verified: false,
    how_to_apply: 'Aplicación online. Video de audición + CV. Revisá la sección de Entertainment en su portal.',
  },
  {
    id: 'd32', name: 'Rixos Hotels — Entertainment', venue_type: 'hotel',
    country: 'Emiratos Árabes', region: 'Medio Oriente',
    description: 'Cadena de hoteles de lujo con sede en Dubai y Turquía. Contratan artistas para shows nocturnos en sus propiedades en Dubai, Antalya y Egipto.',
    website: 'https://www.rixos.com/careers',
    disciplines: ['dancing', 'aerial_silk', 'fire_dance', 'acrobatics', 'singing'],
    verified: false,
    how_to_apply: 'Enviá CV artístico + video al departamento de entretenimiento.',
  },
  {
    id: 'd33', name: 'Grand Hyatt / Hyatt Entertainment', venue_type: 'hotel',
    country: 'Global', region: 'Global',
    description: 'La cadena Hyatt contrata artistas para sus propiedades de lujo en todo el mundo, especialmente en Medio Oriente y Asia.',
    website: 'https://careers.hyatt.com',
    disciplines: ['dancing', 'singing', 'acrobatics', 'aerial_silk'],
    verified: false,
    how_to_apply: 'Portal de empleos corporativo. Buscar "entertainment" o "performer" en el buscador.',
  },

  // ─── CIRCUITO LATINOAMÉRICA ───────────────────────────────────────────────
  {
    id: 'd34', name: 'Circo Tihany — Brasil/Argentina', venue_type: 'circus',
    country: 'Brasil', region: 'América Latina',
    description: 'Uno de los circos más grandes de Sudamérica. Gira por Brasil y Argentina con producciones de gran formato. Buscan artistas de todas las disciplinas.',
    facebook: 'https://www.facebook.com/CircoTihany',
    disciplines: ['acrobatics', 'juggling', 'aerial_silk', 'clown', 'unicycle', 'hand_balance'],
    verified: false,
    how_to_apply: 'Contactar via Facebook o Instagram con video de la actuación.',
  },
  {
    id: 'd35', name: 'Festival de Artes de Valparaíso', venue_type: 'festival',
    country: 'Chile', region: 'América Latina',
    description: 'Festival de artes escénicas y circo contemporáneo en Valparaíso. Plataforma para artistas latinoamericanos con convocatorias anuales.',
    website: 'https://www.festivalvalparaiso.cl',
    disciplines: ['acrobatics', 'aerial_silk', 'clown', 'stilt_walking', 'contemporary_dance'],
    verified: false,
    how_to_apply: 'Convocatoria anual en marzo. Formulario online con dossier y video.',
  },
  {
    id: 'd36', name: 'Circo del Sol — Argentina', venue_type: 'circus',
    country: 'Argentina', region: 'América Latina',
    description: 'Compañía de circo contemporáneo argentina con proyección internacional. Trabajan en festivales de Europa y Latinoamérica.',
    instagram: 'https://www.instagram.com/circodelsol_ar',
    disciplines: ['aerial_silk', 'acrobatics', 'partner_acrobatics', 'hand_balance'],
    verified: false,
    how_to_apply: 'Contactar via Instagram con video de 2-3 min de la actuación.',
  },

  // ─── ASIA / GLOBAL ─────────────────────────────────────────────────────────
  {
    id: 'd37', name: 'Galaxy Entertainment — Macao', venue_type: 'casino',
    country: 'China', region: 'Asia',
    description: 'Grupo de casinos de lujo en Macao. Shows de gran formato con artistas internacionales. Condiciones muy competitivas: alojamiento incluido + salario alto.',
    website: 'https://www.galaxyentertainment.com/en/careers',
    disciplines: ['acrobatics', 'aerial_silk', 'contortion', 'hand_balance', 'dancing'],
    verified: true,
    how_to_apply: 'Portal de empleos online. Buscar "entertainment performer". Video HD obligatorio.',
  },
  {
    id: 'd38', name: 'Wynn Resorts — Entertainment', venue_type: 'casino',
    country: 'Estados Unidos', region: 'América del Norte',
    description: 'Wynn Las Vegas y Encore producen shows de alto presupuesto. Contratan artistas de circo y varieté para sus espectáculos residentes.',
    website: 'https://www.wynnlasvegas.com/careers',
    disciplines: ['acrobatics', 'aerial_silk', 'contortion', 'aerial_trapeze', 'dancing'],
    verified: true,
    how_to_apply: 'Portal de empleos. Video de audición profesional requerido.',
  },
  {
    id: 'd39', name: 'Circa Contemporary Circus — Australia', venue_type: 'circus',
    country: 'Australia', region: 'Oceanía',
    description: 'Compañía australiana de referencia mundial en circo contemporáneo. Con sede en Brisbane, realizan giras internacionales con producciones de alta calidad.',
    website: 'https://www.circa.org.au/work-with-us',
    email: 'admin@circa.org.au',
    disciplines: ['acrobatics', 'aerial_silk', 'hand_balance', 'contortion', 'aerial_trapeze', 'aerial_straps'],
    verified: true,
    how_to_apply: 'Enviá carta de presentación + CV + video (máx 5 min) a admin@circa.org.au',
  },
  {
    id: 'd40', name: 'NoFit State Circus — UK', venue_type: 'circus',
    country: 'Reino Unido', region: 'Europa',
    description: 'Compañía de circo física y contemporánea de Cardiff. Producciones promenade inmersivas de alta visibilidad internacional.',
    website: 'https://www.nofitstate.org/jobs',
    email: 'info@nofitstate.org',
    disciplines: ['aerial_silk', 'acrobatics', 'aerial_hoop', 'partner_acrobatics', 'contortion'],
    verified: true,
    how_to_apply: 'Seguí su web para convocatorias. Experiencia en circo físico/contemporáneo valorada.',
  },

  // ─── FESTIVALES EUROPA ────────────────────────────────────────────────────
  {
    id: 'd41', name: 'Festival International de Théâtre de Rue d\'Aurillac', venue_type: 'festival',
    country: 'Francia', region: 'Europa',
    description: 'Uno de los festivales de teatro callejero más importantes de Europa. Cada agosto en Aurillac, con artistas de circo, teatro y varieté de todo el mundo. Convocatoria abierta anual.',
    email: 'festival@aurillac.net', website: 'https://www.aurillac.net',
    disciplines: ['acrobatics', 'clown', 'stilt_walking', 'juggling', 'aerial_silk', 'fire_dance'],
    verified: true,
    how_to_apply: 'Convocatoria anual en su web. Plazo en primavera. Formulario online + video.',
  },
  {
    id: 'd42', name: 'Chalon dans la Rue', venue_type: 'festival',
    country: 'Francia', region: 'Europa',
    description: 'Festival internacional de artes de calle en Chalon-sur-Saône. Referencia europea para compañías de teatro callejero, circo y danza. Julio.',
    email: 'festival2012@chalondanslarue.com', website: 'https://www.chalondanslarue.com',
    disciplines: ['acrobatics', 'clown', 'stilt_walking', 'juggling', 'contemporary_dance'],
    verified: true,
    how_to_apply: 'Convocatoria anual. Contactar por web. Deadline generalmente en primavera.',
  },
  {
    id: 'd43', name: 'Fira Tàrrega — Mercat de les Arts de Carrer', venue_type: 'festival',
    country: 'España', region: 'Europa',
    description: 'El mercado de artes de calle más importante del sur de Europa. Plataforma profesional en Tàrrega (Cataluña) para compañías de circo, teatro y danza. Septiembre.',
    email: 'info@firatarrega.com', website: 'https://www.firatarrega.cat',
    disciplines: ['acrobatics', 'clown', 'juggling', 'contemporary_dance', 'aerial_silk', 'stilt_walking'],
    verified: true,
    how_to_apply: 'Convocatoria por correo postal antes de abril. Muy competitivo — plataforma profesional.',
  },
  {
    id: 'd44', name: 'Festival Trapezi — Reus', venue_type: 'festival',
    country: 'España', region: 'Europa',
    description: 'Festival de circo contemporáneo de referencia en España, en Reus (Cataluña). Mayo. Seleccionan compañías emergentes y consagradas.',
    email: 'trapezi@reus.cat', website: 'https://www.trapezi.cat',
    disciplines: ['aerial_silk', 'acrobatics', 'juggling', 'clown', 'hand_balance', 'contortion'],
    verified: true,
    how_to_apply: 'Convocatoria anual. Formulario online en su web.',
  },
  {
    id: 'd45', name: 'Edinburgh Festival Fringe', venue_type: 'festival',
    country: 'Reino Unido', region: 'Europa',
    description: 'El festival de artes escénicas más grande del mundo. Agosto en Edimburgo. Cualquier artista puede participar — plataforma de visibilidad máxima.',
    website: 'https://www.edfringe.com', email: 'participants@edfringe.com',
    disciplines: ['acrobatics', 'clown', 'aerial_silk', 'juggling', 'acting', 'magic', 'stand_up'],
    verified: true,
    how_to_apply: 'Registro online abierto todo el año. Se paga por el espacio, pero la visibilidad es enorme.',
  },
  {
    id: 'd46', name: 'La Strada Bremen', venue_type: 'festival',
    country: 'Alemania', region: 'Europa',
    description: 'Festival internacional de teatro callejero y circo en Bremen. Junio. Uno de los festivales más importantes de Alemania para artistas escénicos.',
    email: 'application@strassenzirkus.de', website: 'https://www.lastrada-bremen.de',
    disciplines: ['acrobatics', 'clown', 'stilt_walking', 'juggling', 'aerial_silk', 'fire_dance'],
    verified: true,
    how_to_apply: 'Convocatoria anual. Enviar video + CV artístico al email de aplicación.',
  },
  {
    id: 'd47', name: 'Pflasterspektakel Linz', venue_type: 'festival',
    country: 'Austria', region: 'Europa',
    description: 'Festival de teatro callejero y circo en Linz, Austria. Julio. Uno de los festivales más grandes de Europa central. Pagan a los artistas.',
    website: 'https://www.pflasterspektakel.at', email: 'office@pflasterspektakel.at',
    disciplines: ['acrobatics', 'clown', 'juggling', 'stilt_walking', 'aerial_silk', 'fire_dance'],
    verified: true,
    how_to_apply: 'Convocatoria online cada enero. Formulario + video obligatorio.',
  },
  {
    id: 'd48', name: 'La Strada Graz', venue_type: 'festival',
    country: 'Austria', region: 'Europa',
    description: 'Festival internacional de teatro de calle en Graz, Austria. Agosto. Eventos en distintos espacios de la ciudad con artistas de todo el mundo.',
    email: 'info@lastrada.at', website: 'https://www.lastrada.at',
    disciplines: ['acrobatics', 'clown', 'juggling', 'stilt_walking', 'aerial_silk'],
    verified: true,
    how_to_apply: 'Contactar por email con propuesta artística + video. Convocatoria en primavera.',
  },
  {
    id: 'd49', name: 'Spancirfest — Varaždin', venue_type: 'festival',
    country: 'Croacia', region: 'Europa',
    description: 'Festival internacional de teatro callejero en Varaždin, Croacia. Agosto. Artistas de más de 30 países. Muy bien organizado con buen pago.',
    website: 'https://www.spancirfest.com',
    disciplines: ['acrobatics', 'clown', 'juggling', 'stilt_walking', 'aerial_silk', 'music'],
    verified: true,
    how_to_apply: 'Convocatoria online. Formulario en su web. Deadline generalmente en marzo.',
  },
  {
    id: 'd50', name: 'Mirabilia International Circus Festival', venue_type: 'festival',
    country: 'Italia', region: 'Europa',
    description: 'Festival internacional de circo y artes escénicas en Fossano, Italia. Verano. Referencia italiana para circo contemporáneo.',
    email: 'info@festivalmirabilia.it', website: 'https://www.festivalmirabilia.it',
    disciplines: ['aerial_silk', 'acrobatics', 'juggling', 'contortion', 'clown', 'hand_balance'],
    verified: true,
    how_to_apply: 'Convocatoria anual. Dossier artístico + video. Contactar por email.',
  },
  {
    id: 'd51', name: 'Young Stage — Festival Basel', venue_type: 'festival',
    country: 'Suiza', region: 'Europa',
    description: 'Festival internacional de circo en Basilea, Suiza. Concurso para artistas jóvenes emergentes. Gran visibilidad europea.',
    email: 'info@young-stage.com', website: 'https://www.young-stage.com',
    disciplines: ['aerial_silk', 'acrobatics', 'juggling', 'contortion', 'hand_balance', 'clown'],
    verified: true,
    how_to_apply: 'Convocatoria anual. Video HD del número + formulario. Ver web para fechas.',
  },
  {
    id: 'd52', name: 'Buskers Bern', venue_type: 'festival',
    country: 'Suiza', region: 'Europa',
    description: 'Festival de músicos y artistas callejeros en Berna. Agosto. Uno de los mejores festivales de busking de Europa, bien remunerado.',
    email: 'artist@buskersbern.ch', website: 'https://www.buskersbern.ch',
    disciplines: ['juggling', 'acrobatics', 'clown', 'magic', 'fire_dance', 'busking'],
    verified: true,
    how_to_apply: 'Formulario online en su web. Convocatoria abre en febrero/marzo.',
  },
  {
    id: 'd53', name: 'Sibiu International Theatre Festival', venue_type: 'festival',
    country: 'Rumania', region: 'Europa',
    description: 'Festival de teatro y artes escénicas en Sibiu, Rumania. Junio. Uno de los festivales más grandes de Europa del Este. Muy bien organizado.',
    email: 'festival@sibfest.ro', website: 'https://www.sibfest.ro',
    disciplines: ['acrobatics', 'aerial_silk', 'clown', 'stilt_walking', 'acting', 'contemporary_dance'],
    verified: true,
    how_to_apply: 'Convocatoria anual. Formulario online. Alojamiento incluido para artistas seleccionados.',
  },
  {
    id: 'd54', name: 'Malta Festival Poznań', venue_type: 'festival',
    country: 'Polonia', region: 'Europa',
    description: 'Festival internacional de teatro y artes de calle en Poznań, Polonia. Junio. Referencia en Europa Central para artes escénicas contemporáneas.',
    email: 'office@malta-festival.pl', website: 'https://www.malta-festival.pl',
    disciplines: ['acrobatics', 'contemporary_dance', 'clown', 'stilt_walking', 'aerial_silk'],
    verified: true,
    how_to_apply: 'Contactar por email con dossier artístico.',
  },
  {
    id: 'd55', name: 'Noorderzon Festival — Groningen', venue_type: 'festival',
    country: 'Países Bajos', region: 'Europa',
    description: 'Festival de artes escénicas y música en Groningen, Holanda. Agosto. Ambiente artístico único en un parque. Muy bien pagado.',
    email: 'info@noorderzon.nl', website: 'https://www.noorderzon.nl',
    disciplines: ['acrobatics', 'contemporary_dance', 'clown', 'aerial_silk', 'juggling'],
    verified: true,
    how_to_apply: 'Contactar con dossier + video. Muy selectivo.',
  },
  {
    id: 'd56', name: 'MiramirO Festival — Gante', venue_type: 'festival',
    country: 'Bélgica', region: 'Europa',
    description: 'Festival de artes de calle en Gante, Bélgica. Julio. Programación de alta calidad en los canales de la ciudad.',
    email: 'miramiro@miramiro.be', website: 'https://www.miramiro.be',
    disciplines: ['acrobatics', 'clown', 'aerial_silk', 'juggling', 'stilt_walking'],
    verified: true,
    how_to_apply: 'Convocatoria anual. Formulario online.',
  },
  {
    id: 'd57', name: 'Zomer in Antwerpen', venue_type: 'festival',
    country: 'Bélgica', region: 'Europa',
    description: 'Festival de verano de Amberes. Todo el verano. Programa artistas de calle, circo y teatro en toda la ciudad. Bien organizado.',
    email: 'zomer@zva.be', website: 'https://www.zva.be',
    disciplines: ['acrobatics', 'clown', 'stilt_walking', 'juggling', 'aerial_silk'],
    verified: true,
    how_to_apply: 'Convocatoria anual. Formulario online en su web.',
  },
  {
    id: 'd58', name: 'Hat Fair Winchester', venue_type: 'festival',
    country: 'Reino Unido', region: 'Europa',
    description: 'Festival de teatro callejero en Winchester, UK. Julio. Uno de los festivales de busking más respetados de Europa. Artistas cobran por sombrero.',
    email: 'info@hatfair.co.uk', website: 'https://www.hatfair.co.uk',
    disciplines: ['acrobatics', 'clown', 'juggling', 'magic', 'fire_dance', 'busking'],
    verified: true,
    how_to_apply: 'Convocatoria online. Formulario en web. Plataforma para artistas de calle.',
  },
  {
    id: 'd59', name: 'Greenwich+Docklands International Festival', venue_type: 'festival',
    country: 'Reino Unido', region: 'Europa',
    description: 'Festival de teatro al aire libre en Londres. Junio. Shows gratuitos de gran formato en espacios emblemáticos de la ciudad.',
    email: 'admin@festival.org', website: 'https://www.festival.org',
    disciplines: ['acrobatics', 'stilt_walking', 'clown', 'aerial_silk', 'contemporary_dance'],
    verified: true,
    how_to_apply: 'Contactar con propuesta artística. Programan compañías con espectáculos completos.',
  },
  {
    id: 'd60', name: 'Ana Desetnica — Ljubljana', venue_type: 'festival',
    country: 'Eslovenia', region: 'Europa',
    description: 'Festival internacional de teatro callejero en Ljubljana, Eslovenia. Julio. Ambiente único en una ciudad hermosa. Pagan a los artistas.',
    email: 'ana.monro@kud-fp.si', website: 'https://www.anamonro.si',
    disciplines: ['acrobatics', 'clown', 'stilt_walking', 'juggling', 'contemporary_dance'],
    verified: true,
    how_to_apply: 'Convocatoria anual. Formulario + video. Alojamiento y viáticos incluidos.',
  },
  {
    id: 'd61', name: 'Porsgrunn International Theatre Festival', venue_type: 'festival',
    country: 'Noruega', region: 'Europa',
    description: 'Festival de teatro callejero en Porsgrunn, Noruega. Junio. Uno de los mejores festivales escandinavos. Excelentes condiciones para artistas.',
    email: 'post@pitfestival.no', website: 'https://www.pitfestival.no',
    disciplines: ['acrobatics', 'clown', 'stilt_walking', 'juggling', 'contemporary_dance'],
    verified: true,
    how_to_apply: 'Convocatoria anual. Formulario online.',
  },
  {
    id: 'd62', name: 'Artisti in Piazza — Pennabilli', venue_type: 'festival',
    country: 'Italia', region: 'Europa',
    description: 'Festival de artistas de calle en Pennabilli, Italia. Junio. Ambiente medieval único. Seleccionan artistas individuales y compañías de todo el mundo.',
    website: 'https://www.artistiinpiazza.com', email: 'info@artistiinpiazza.com',
    disciplines: ['juggling', 'clown', 'acrobatics', 'magic', 'fire_dance', 'busking'],
    verified: true,
    how_to_apply: 'Formulario online en su web antes de marzo.',
  },
  {
    id: 'd63', name: 'Umore Azoka — Bilbao', venue_type: 'festival',
    country: 'España', region: 'Europa',
    description: 'Festival de humor y artes escénicas en Bilbao. Mayo. Referencia para clown, teatro físico y varieté en el País Vasco.',
    email: 'info@umoreazoka.org', website: 'https://www.umoreazoka.org',
    disciplines: ['clown', 'acting', 'stand_up', 'juggling', 'acrobatics'],
    verified: true,
    how_to_apply: 'Convocatoria anual. Formulario online.',
  },
  {
    id: 'd64', name: 'Spoffin Street Arts Festival — Amersfoort', venue_type: 'festival',
    country: 'Países Bajos', region: 'Europa',
    description: 'Festival de artes de calle en Amersfoort, Holanda. Agosto. Muy bien organizado con buena remuneración para artistas.',
    email: 'festival@spoffin.nl', website: 'https://www.spoffin.nl',
    disciplines: ['acrobatics', 'clown', 'juggling', 'stilt_walking', 'aerial_silk'],
    verified: true,
    how_to_apply: 'Convocatoria online. Plataforma de video obligatoria.',
  },

  // ─── COMPAÑÍAS ────────────────────────────────────────────────────────────
  {
    id: 'd65', name: 'Giffords Circus — UK', venue_type: 'circus',
    country: 'Reino Unido', region: 'Europa',
    description: 'Compañía de circo boutique muy reconocida del Reino Unido. Shows de temporada en el Cotswolds. Estética vintage de alta calidad. Contratos de gira.',
    email: 'info@giffordscircus.com', website: 'https://www.giffordscircus.com',
    disciplines: ['acrobatics', 'aerial_silk', 'clown', 'juggling', 'contortion'],
    verified: true,
    how_to_apply: 'Contactar por email con video + CV artístico.',
  },
  {
    id: 'd66', name: 'Compagnia Finzi Pasca — Suiza/Italia', venue_type: 'production_company',
    country: 'Suiza', region: 'Global',
    description: 'Compañía internacional de teatro y circo lírica. Creadores de ceremonias olímpicas (Vancouver, Sochi, Milán). Shows de gran formato y teatro íntimo.',
    email: 'info@finzipasca.com', website: 'https://www.finzipasca.com',
    disciplines: ['acrobatics', 'aerial_silk', 'contemporary_dance', 'contortion', 'hand_balance'],
    verified: true,
    how_to_apply: 'Enviá dossier + video. Buscan artistas con perfil actoral y técnica sólida.',
  },
  {
    id: 'd67', name: 'Circo Raluy Legacy — España', venue_type: 'circus',
    country: 'España', region: 'Europa',
    description: 'El circo más antiguo de España, fundado en 1896. Gira por la Península Ibérica. Estética vintage de lujo. Buscan artistas para temporadas.',
    email: 'info@raluy.com', website: 'https://www.circoraluy.com',
    disciplines: ['acrobatics', 'aerial_silk', 'clown', 'juggling', 'contortion', 'hand_balance'],
    verified: true,
    how_to_apply: 'Contactar por email con video + CV. Audiciones periódicas.',
  },
  {
    id: 'd68', name: 'Circus Oz — Australia', venue_type: 'circus',
    country: 'Australia', region: 'Oceanía',
    description: 'Compañía de circo contemporáneo australiana de renombre mundial. Producen espectáculos con foco en acrobacia, física y mensaje social. Giras internacionales.',
    email: 'info@circusoz.com', website: 'https://www.circusoz.com',
    disciplines: ['acrobatics', 'aerial_silk', 'aerial_hoop', 'partner_acrobatics', 'hand_balance'],
    verified: true,
    how_to_apply: 'Convocatorias periódicas en su web. Enviá carta + video + CV.',
  },
  {
    id: 'd69', name: 'Cirque Éloize — Montréal', venue_type: 'production_company',
    country: 'Canadá', region: 'América del Norte',
    description: 'Compañía icónica de circo contemporáneo de Montréal fundada en 1993. Mezclan circo, danza, música en vivo y teatro. Han actuado en más de 500 ciudades en 50 países. Producciones: iD, Cirkopolis, Hotel, Rain. Shows en residencia y giras mundiales.',
    email: 'casting@cirque-eloize.com', website: 'https://www.cirque-eloize.com',
    contact_name: 'Equipo de Casting', instagram: 'https://www.instagram.com/cirqueeloize',
    disciplines: ['acrobatics', 'aerial_silk', 'aerial_hoop', 'contortion', 'dancing', 'hand_balance', 'juggling', 'partner_acrobatics'],
    verified: true,
    how_to_apply: 'Enviá dossier artístico + video de máx. 5 min a casting@cirque-eloize.com. Buscan artistas multidisciplinarios con perfil físico-actoral.',
  },

  // ─── ESCUELAS ─────────────────────────────────────────────────────────────
  {
    id: 'd70', name: 'CNAC — Centre National des Arts du Cirque', venue_type: 'school',
    country: 'Francia', region: 'Europa',
    description: 'La escuela nacional de circo más importante de Francia y una de las mejores del mundo. Forma a los artistas más destacados del circo contemporáneo europeo.',
    email: 'contact@cnac.fr', website: 'https://www.cnac.fr',
    disciplines: ['aerial_silk', 'acrobatics', 'juggling', 'clown', 'hand_balance', 'contortion'],
    verified: true,
    how_to_apply: 'Audiciones anuales de alta competencia. Ver su web para convocatorias.',
  },
  {
    id: 'd71', name: 'Académie Fratellini — París', venue_type: 'school',
    country: 'Francia', region: 'Europa',
    description: 'Escuela de circo y artes de la pista en Saint-Denis, París. Formación profesional de alto nivel. También tiene residencias artísticas y producciones.',
    email: 'contact@academie-fratellini.com', website: 'https://www.academie-fratellini.com',
    disciplines: ['aerial_silk', 'acrobatics', 'juggling', 'clown', 'contortion'],
    verified: true,
    how_to_apply: 'Admisión anual con audición presencial. Ver convocatorias en su web.',
  },
  {
    id: 'd72', name: 'Escuela de Circo Carampa — Madrid', venue_type: 'school',
    country: 'España', region: 'Europa',
    description: 'La escuela de circo más importante de España, en Madrid. Formación profesional de 3 años + residencias y laboratorios de creación.',
    email: 'info@carampa.com', website: 'https://www.carampa.com',
    disciplines: ['aerial_silk', 'acrobatics', 'juggling', 'clown', 'hand_balance', 'contortion'],
    verified: true,
    how_to_apply: 'Audiciones anuales en junio. Ver su web para inscripción.',
  },
  {
    id: 'd73', name: 'Flic Scuola di Circo — Turín', venue_type: 'school',
    country: 'Italia', region: 'Europa',
    description: 'Escuela de circo profesional en Turín. Una de las mejores de Italia. Formación de 3 años + producción de espectáculos finales.',
    email: 'info@flicscuolacirco.it', website: 'https://www.flicscuolacirco.it',
    disciplines: ['aerial_silk', 'acrobatics', 'juggling', 'clown', 'contortion', 'hand_balance'],
    verified: true,
    how_to_apply: 'Audiciones anuales. Ver web para fechas y requisitos.',
  },
  {
    id: 'd74', name: 'National Centre for Circus Arts — Londres', venue_type: 'school',
    country: 'Reino Unido', region: 'Europa',
    description: 'Centro nacional de artes circenses del Reino Unido. Formación profesional de alto nivel + residencias artísticas para profesionales.',
    email: 'info@nationalcircus.org.uk', website: 'https://www.nationalcircus.org.uk',
    disciplines: ['aerial_silk', 'acrobatics', 'juggling', 'clown', 'hand_balance', 'contortion'],
    verified: true,
    how_to_apply: 'Admisión anual con audición. También ofrecen clases cortas para profesionales.',
  },

  // ─── TEATROS Y VENUES ESPECIALIZADOS ─────────────────────────────────────
  {
    id: 'd75', name: 'Teatro Circo Price — Madrid', venue_type: 'theater',
    country: 'España', region: 'Europa',
    description: 'El teatro circo más emblemático de España, en Madrid. Programan espectáculos de circo contemporáneo y varieté durante todo el año. Convocatorias periódicas.',
    email: 'info@teatrocircoprice.es', website: 'https://www.teatrocircoprice.es',
    disciplines: ['aerial_silk', 'acrobatics', 'juggling', 'clown', 'contortion', 'hand_balance'],
    verified: true,
    how_to_apply: 'Contactar departamento artístico con dossier + video de la propuesta.',
  },
  {
    id: 'd76', name: 'Europa-Park — Rust, Alemania', venue_type: 'theme_park',
    country: 'Alemania', region: 'Europa',
    description: 'El mayor parque temático de Alemania y uno de los más visitados de Europa. Shows diarios con artistas de circo y variedades. Contratos de temporada.',
    email: 'info@europapark.de', website: 'https://www.europapark.de',
    disciplines: ['acrobatics', 'aerial_silk', 'dancing', 'stilt_walking', 'clown', 'juggling'],
    verified: true,
    how_to_apply: 'Portal de empleo en su web. Buscar "artistas" o "entertainment".',
  },
  {
    id: 'd77', name: 'PortAventura — Salou, España', venue_type: 'theme_park',
    country: 'España', region: 'Europa',
    description: 'El mayor parque temático de España. Shows en vivo con artistas de circo, acrobacia y danza. Temporada de verano + Navidad + Halloween.',
    email: 'portaventura@portaventura.es', website: 'https://www.portaventura.com',
    disciplines: ['acrobatics', 'dancing', 'aerial_silk', 'stilt_walking', 'clown'],
    verified: true,
    how_to_apply: 'Portal de empleo en su web. Audiciones anuales en Barcelona y Madrid.',
  },
  {
    id: 'd78', name: 'Festival Melbourne International Arts Festival', venue_type: 'festival',
    country: 'Australia', region: 'Oceanía',
    description: 'Festival de artes escénicas de Melbourne. Octubre. Programa artistas nacionales e internacionales de circo, teatro y danza.',
    email: 'info@festival.melbourne', website: 'https://www.festival.melbourne',
    disciplines: ['acrobatics', 'aerial_silk', 'contemporary_dance', 'clown', 'juggling'],
    verified: true,
    how_to_apply: 'Convocatoria anual. Contactar con propuesta artística completa.',
  },
  {
    id: 'd79', name: 'World Buskers Festival — Christchurch', venue_type: 'festival',
    country: 'Nueva Zelanda', region: 'Oceanía',
    description: 'Festival de busking más grande del hemisferio sur. Enero en Christchurch. Excelente remuneración y ambiente festivo único.',
    email: 'apply@worldbuskersfestival.com', website: 'https://www.worldbuskersfestival.com',
    disciplines: ['juggling', 'acrobatics', 'clown', 'magic', 'fire_dance', 'busking'],
    verified: true,
    how_to_apply: 'Convocatoria online anual. Formulario + video de la actuación.',
  },
  {
    id: 'd80', name: 'Just pour rire — Festival Montréal', venue_type: 'festival',
    country: 'Canadá', region: 'América del Norte',
    description: 'El festival de humor más grande del mundo, en Montréal. Julio. Incluye programación de circo, varieté y teatro físico. Gran visibilidad internacional.',
    email: 'CLantagne@hahaha.com', website: 'https://www.hahaha.com',
    disciplines: ['clown', 'stand_up', 'juggling', 'acrobatics', 'magic'],
    verified: true,
    how_to_apply: 'Contactar con propuesta artística. Principalmente para actos de humor y varieté.',
  },

  // ─── COMPAÑÍAS EUROPEAS CONTEMPORÁNEAS ────────────────────────────────────
  {
    id: 'd81', name: 'Cirkus Cirkör — Estocolmo', venue_type: 'circus',
    country: 'Suecia', region: 'Europa',
    description: 'Una de las compañías de circo social y contemporáneo más importantes de Europa. Fundada en 1995 en Estocolmo. Conocidos por su compromiso político y social, mezclan circo de alto nivel técnico con narrativa poderosa. Producciones: Knitting Peace, Epifónema, LIMITS. Giran por toda Europa y tienen residencia en Estocolmo.',
    email: 'casting@cirkuscirkor.se', website: 'https://www.cirkuscirkor.se',
    contact_name: 'Casting Department', instagram: 'https://www.instagram.com/cirkuscirkor',
    disciplines: ['aerial_silk', 'aerial_rope', 'acrobatics', 'juggling', 'hand_balance', 'contortion', 'partner_acrobatics', 'clown'],
    verified: true,
    how_to_apply: 'Convocatorias periódicas en su web. Enviá CV + video a casting@cirkuscirkor.se. Buscan artistas con conciencia social y excelencia técnica.',
  },
  {
    id: 'd82', name: 'Compagnie XY — Francia', venue_type: 'circus',
    country: 'Francia', region: 'Europa',
    description: 'Colectivo francés de 23 acróbatas fundado en 2009. Especialistas en acrobacia colectiva sin red, sin lona y sin podio. Sus espectáculos "Il n\'est pas encore minuit" y "Möbius" recorrieron el mundo entero. Residencia en Orléans. Una de las compañías más respetadas del nuevo circo europeo.',
    email: 'contact@compagnie-xy.com', website: 'https://www.compagnie-xy.com',
    contact_name: 'Compagnie XY — Casting',
    disciplines: ['acrobatics', 'partner_acrobatics', 'hand_balance', 'aerial_silk'],
    verified: true,
    how_to_apply: 'Convocan en función de proyectos. Enviá dossier y video a contact@compagnie-xy.com.',
  },
  {
    id: 'd83', name: 'Gravity & Other Myths — Adelaide', venue_type: 'circus',
    country: 'Australia', region: 'Global',
    description: 'Compañía australiana de circo contemporáneo radicada en Adelaide. Fundada en 2009. Conocidos por sus espectáculos cargados de energía y humor: "A Simple Space", "Backbone", "Out of Chaos". Giras extensas por Europa, Asia y América. Premio Total Theatre Award. Una de las compañías más activas en gira a nivel mundial.',
    email: 'info@gravityandothermyths.com', website: 'https://www.gravityandothermyths.com',
    instagram: 'https://www.instagram.com/gravityandothermyths',
    contact_name: 'Casting — Gravity & Other Myths',
    disciplines: ['acrobatics', 'partner_acrobatics', 'hand_balance', 'aerial_silk', 'juggling'],
    verified: true,
    how_to_apply: 'Audiciones periódicas en Australia y en gira. Ver su web y redes para convocatorias.',
  },
  {
    id: 'd84', name: 'Cirk La Putyka — Praga', venue_type: 'circus',
    country: 'República Checa', region: 'Europa',
    description: 'Compañía de circo contemporáneo más importante de Europa del Este. Fundada en 2009 en Praga por Rostislav Novák. Mezclan circo, teatro físico y danza. Producciones: Boys Don\'t Cry, Cirkus Cirkus, Spina. Residencia en el Teatro Ponec de Praga. Giran por festivales de primer nivel mundial.',
    email: 'casting@laPutyka.cz', website: 'https://www.laputyka.cz',
    contact_name: 'Casting — Cirk La Putyka',
    disciplines: ['acrobatics', 'aerial_silk', 'juggling', 'contortion', 'hand_balance', 'clown', 'dancing'],
    verified: true,
    how_to_apply: 'Convocan artistas para proyectos específicos. Enviá dossier + video a casting@laputyka.cz.',
  },
  {
    id: 'd85', name: 'Cie. Baro d\'evel — París/Barcelona', venue_type: 'circus',
    country: 'Francia', region: 'Europa',
    description: 'Compañía franco-española de circo y teatro con animales (caballos, pájaros). Fundada por Camille Decourtye y Blaï Mateu Trias. Obras: Pitt Oüt, Bestias, Qui som?. Trabajo poético y visual único. Residencia entre Francia y España. Giras por los festivales más importantes del mundo.',
    email: 'info@barodel.net', website: 'https://www.barodel.net',
    instagram: 'https://www.instagram.com/barodel_cirque',
    disciplines: ['aerial_silk', 'acrobatics', 'clown', 'hand_balance', 'partner_acrobatics'],
    verified: true,
    how_to_apply: 'Convocan según proyectos. Contacto vía web.',
  },
  {
    id: 'd86', name: 'Cie. Akoreacro — Francia', venue_type: 'circus',
    country: 'Francia', region: 'Europa',
    description: 'Compañía francesa de nuevo circo fundada en 2005 en Lyon. Mezclan acrobacia, danza hip-hop y música en vivo con energía explosiva. Producciones: Halka, Origines, Corps à Corps. Giras extensas por Europa, Asia, América Latina y África.',
    email: 'contact@akoreacro.fr', website: 'https://www.akoreacro.fr',
    contact_name: 'Casting — Akoreacro',
    disciplines: ['acrobatics', 'partner_acrobatics', 'dancing', 'hand_balance', 'aerial_silk'],
    verified: true,
    how_to_apply: 'Convocan para proyectos. Enviá CV + video de audición a contact@akoreacro.fr.',
  },
  {
    id: 'd87', name: 'Gandini Juggling — Londres', venue_type: 'circus',
    country: 'Reino Unido', region: 'Europa',
    description: 'Compañía de malabarismo de talla mundial fundada en 1992 en Londres. Han colaborado con la Royal Opera House, Alvin Ailey Dance Theater y Pina Bausch Company. Combinan malabarismo con danza contemporánea. Producción: Smashed. Referentes absolutos del malabarismo artístico.',
    email: 'info@gandinijuggling.com', website: 'https://gandinijuggling.com',
    contact_name: 'Sean Gandini',
    disciplines: ['juggling', 'dancing', 'partner_acrobatics'],
    verified: true,
    how_to_apply: 'Convocan artistas de malabarismo para proyectos. Contacto vía web o email.',
  },
  {
    id: 'd88', name: 'Ockham\'s Razor — Reino Unido', venue_type: 'circus',
    country: 'Reino Unido', region: 'Europa',
    description: 'Compañía británica de circo físico fundada en 2004. Trabajan con aparatos de su propia creación. Producciones: Arc, Every Action Alone, Another Kind of Silence. Estilo poético y minimalista. Residencia en Londres. Giras internacionales.',
    email: 'info@ockhamsrazor.co.uk', website: 'https://www.ockhamsrazor.co.uk',
    disciplines: ['aerial_silk', 'aerial_rope', 'hand_balance', 'acrobatics'],
    verified: true,
    how_to_apply: 'Convocan para producciones específicas. Contacto vía web.',
  },
  {
    id: 'd89', name: 'Circo Aereo — Helsinki/Francia', venue_type: 'circus',
    country: 'Finlandia', region: 'Europa',
    description: 'Compañía finlandesa-francesa de circo contemporáneo fundada en 1996. Mezclan circo, teatro físico y danza. Producciones: Wild Wild Wets, Tamar & Other Tunes, The Space Between. Presencia fuerte en festivales europeos y giras internacionales.',
    email: 'info@circoaereo.com', website: 'https://www.circoaereo.com',
    disciplines: ['aerial_silk', 'acrobatics', 'hand_balance', 'partner_acrobatics', 'clown'],
    verified: true,
    how_to_apply: 'Convocan artistas según proyectos. Contacto vía web o email.',
  },
  {
    id: 'd90', name: 'Cie. Galapiat Cirque — Bélgica/Francia', venue_type: 'circus',
    country: 'Bélgica', region: 'Europa',
    description: 'Colectivo belgo-francés de circo contemporáneo radicado en Bruselas. Fundado en 2008. Obras: Bradibus, Les Étoiles, Buffet. Espíritu colectivo y arte circense comprometido con el territorio. Giras por festivales europeos.',
    email: 'info@galapiatchirque.be', website: 'https://www.galapiatchirque.be',
    disciplines: ['juggling', 'acrobatics', 'hand_balance', 'clown', 'partner_acrobatics'],
    verified: true,
    how_to_apply: 'Convocan según proyectos. Contacto vía web.',
  },

  // ─── COMPAÑÍAS LATINOAMERICANAS ───────────────────────────────────────────
  {
    id: 'd91', name: 'Fuerza Bruta — Buenos Aires', venue_type: 'production_company',
    country: 'Argentina', region: 'América Latina',
    description: 'Productora de espectáculos de inmersión fundada en Buenos Aires por Diqui James. Show icónico "Fuerza Bruta" ha girado por 40 países. Mezclan acrobacia aérea, teatro, performance y música en shows de 360°. También producen "WA" y "Look Up". Buscan artistas con perfil físico y performático.',
    email: 'casting@fuerzabruta.com', website: 'https://www.fuerzabruta.net',
    contact_name: 'Casting Fuerza Bruta', instagram: 'https://www.instagram.com/fuerzabruta',
    disciplines: ['aerial_silk', 'acrobatics', 'dancing', 'partner_acrobatics', 'swimming'],
    verified: true,
    how_to_apply: 'Audiciones periódicas en Buenos Aires. Seguí sus redes para convocatorias. Enviá CV + video a casting@fuerzabruta.com.',
  },
  {
    id: 'd92', name: 'De La Guarda / Fuerza Bruta Argentina', venue_type: 'production_company',
    country: 'Argentina', region: 'América Latina',
    description: 'Pioneros del teatro aéreo inmersivo latinoamericano. "De La Guarda" (Villa Villa) fue un fenómeno mundial en los \'90 con residencia en Broadway. Antecesores directos de Fuerza Bruta. Buscan performers con capacidad aérea, físico y presencia escénica potente.',
    email: 'info@delaguarda.com', website: 'https://www.fuerzabruta.net',
    disciplines: ['aerial_silk', 'acrobatics', 'dancing', 'partner_acrobatics'],
    verified: true,
    how_to_apply: 'Audiciones convocadas periódicamente en Buenos Aires. Ver redes sociales.',
  },
  {
    id: 'd93', name: 'La Tarumba — Lima', venue_type: 'circus',
    country: 'Perú', region: 'América Latina',
    description: 'La compañía de circo más importante de América del Sur. Fundada en 1984 en Lima. Mezclan circo, teatro, danza y música peruana. Tienen escuela de circo y producen espectáculos de gran formato. Referente del circo social latinoamericano.',
    email: 'info@latarumba.com', website: 'https://www.latarumba.com',
    instagram: 'https://www.instagram.com/latarumba_circo',
    disciplines: ['acrobatics', 'aerial_silk', 'juggling', 'clown', 'dancing', 'partner_acrobatics'],
    verified: true,
    how_to_apply: 'Audiciones anuales en Lima. Seguí sus redes para convocatorias.',
  },
  {
    id: 'd94', name: 'Intrépida Cia. de Circo — Brasil', venue_type: 'circus',
    country: 'Brasil', region: 'América Latina',
    description: 'Compañía de circo contemporáneo con base en Río de Janeiro. Una de las más activas de Brasil. Mezclan circo, danza contemporánea y teatro. Han participado en festivales en Europa y América. Producen creaciones propias y contratan artistas.',
    email: 'contato@intrepida.com.br', website: 'https://www.intrepida.com.br',
    instagram: 'https://www.instagram.com/intrepidaciadecirc',
    disciplines: ['aerial_silk', 'aerial_hoop', 'acrobatics', 'contortion', 'partner_acrobatics', 'dancing'],
    verified: true,
    how_to_apply: 'Convocan artistas para producciones y proyectos. Contacto vía web o Instagram.',
  },

  // ─── PÔLES NACIONALES Y CENTROS DE CREACIÓN ───────────────────────────────
  {
    id: 'd95', name: 'La Brèche — Pôle national Cirque Normandie', venue_type: 'theater',
    country: 'Francia', region: 'Europa',
    description: 'Pôle national des arts du cirque en Cherbourg, Normandía. Centro de residencias, producción y difusión del circo contemporáneo en Francia. Apoyan a compañías emergentes y programan espectáculos internacionales. Residencias abiertas a compañías de todo el mundo.',
    email: 'contact@labreche.fr', website: 'https://www.labreche.fr',
    contact_name: 'Equipo artístico — La Brèche',
    disciplines: ['aerial_silk', 'juggling', 'acrobatics', 'clown', 'hand_balance', 'contortion'],
    verified: true,
    how_to_apply: 'Convocatoria anual de residencias para compañías. Ver su web para fechas.',
  },
  {
    id: 'd96', name: 'Le Lido — Centre des arts du cirque de Toulouse', venue_type: 'theater',
    country: 'Francia', region: 'Europa',
    description: 'Centro nacional de artes del circo en Toulouse. Eje fundamental del ecosistema circense francés. Ofrecen formación avanzada, residencias artísticas y coproducción de espectáculos. Espacio de referencia para artistas de circo en Francia y Europa.',
    email: 'accueil@lelido.fr', website: 'https://www.lelido.fr',
    contact_name: 'Direction artistique',
    disciplines: ['aerial_silk', 'juggling', 'acrobatics', 'hand_balance', 'contortion', 'clown'],
    verified: true,
    how_to_apply: 'Formación continua para profesionales + residencias. Ver convocatorias en su web.',
  },
  {
    id: 'd97', name: 'ESAC — École Supérieure des Arts du Cirque, Bruselas', venue_type: 'school',
    country: 'Bélgica', region: 'Europa',
    description: 'La escuela superior de artes del circo más importante de Bélgica. Formación en 3 años a nivel europeo. Ubicada en Bruselas, una de las capitales del circo contemporáneo europeo. Convocatoria internacional.',
    email: 'info@esac.be', website: 'https://www.esac.be',
    contact_name: 'Admisiones ESAC',
    disciplines: ['aerial_silk', 'aerial_rope', 'juggling', 'acrobatics', 'hand_balance', 'contortion', 'clown'],
    verified: true,
    how_to_apply: 'Audiciones internacionales anuales. Formulario en su web.',
  },
  {
    id: 'd98', name: 'Codarts Rotterdam — Circus Arts', venue_type: 'school',
    country: 'Países Bajos', region: 'Europa',
    description: 'Conservatorio de Rotterdam con programa de Circus Arts de 4 años. Forma artistas de circo de nivel europeo. Una de las pocas escuelas con titulación oficial en circo en Países Bajos.',
    email: 'info@codarts.nl', website: 'https://www.codarts.nl/circus',
    contact_name: 'Circus Arts Admissions',
    disciplines: ['aerial_silk', 'aerial_rope', 'juggling', 'acrobatics', 'hand_balance', 'contortion'],
    verified: true,
    how_to_apply: 'Audiciones anuales en Rotterdam. Ver fechas en su web.',
  },

  // ─── AGENCIAS DE BOOKING Y CASTING ───────────────────────────────────────
  {
    id: 'd99', name: 'World Wide Casting — Artistas Escénicos', venue_type: 'agency',
    country: 'Internacional', region: 'Global',
    description: 'Agencia internacional de casting para artistas escénicos: circo, acrobacia, danza, teatro físico. Representan artistas para cruceros, parques temáticos, hoteles y producciones de gran formato en todo el mundo.',
    website: 'https://www.worldwidecasting.com',
    email: 'casting@worldwidecasting.com',
    disciplines: ['aerial_silk', 'aerial_hoop', 'acrobatics', 'contortion', 'juggling', 'dancing', 'fire_poi'],
    verified: true,
    how_to_apply: 'Registrarse en su web como artista. Incluir fotos profesionales + video de actuación.',
  },
  {
    id: 'd100', name: 'CircusInfo.net — Directorio Global', venue_type: 'agency',
    country: 'Internacional', region: 'Global',
    description: 'Plataforma de referencia para el sector circense mundial. Base de datos de compañías, festivales, escuelas y agencias. Publica convocatorias de trabajo y audiciones internacionales. Fundamental para conectar con el ecosistema global del circo.',
    website: 'https://www.circusinfo.net',
    disciplines: ['aerial_silk', 'juggling', 'acrobatics', 'clown', 'hand_balance', 'contortion'],
    verified: true,
    how_to_apply: 'Registrar tu perfil como artista para aparecer en el directorio.',
  },
  {
    id: 'd101', name: 'Circostrada — Red Europea de Circo', venue_type: 'agency',
    country: 'Francia', region: 'Europa',
    description: 'Red europea de circo y artes de calle con más de 100 miembros en 30 países. Publican convocatorias de financiación, residencias, festivales y oportunidades de movilidad artística en Europa. Base en París (Hors les Murs).',
    website: 'https://www.circostrada.org', email: 'circostrada@horslesmurs.fr',
    disciplines: ['aerial_silk', 'juggling', 'acrobatics', 'clown', 'fire_poi', 'street_performance'],
    verified: true,
    how_to_apply: 'Seguir sus convocatorias de financiación y residencias. Membresía disponible para organizaciones.',
  },
  {
    id: 'd102', name: 'Extraordinary Bodies — Reino Unido', venue_type: 'circus',
    country: 'Reino Unido', region: 'Europa',
    description: 'Compañía pionera en la inclusión de artistas con discapacidad en circo contemporáneo. Proyecto de Cirque Bijou y Diverse City. Shows de gran formato con artistas disabled y no-disabled. Modelo de inclusión referente a nivel mundial.',
    email: 'info@extraordinarybodies.co.uk', website: 'https://www.extraordinarybodies.co.uk',
    disciplines: ['aerial_silk', 'acrobatics', 'partner_acrobatics', 'dancing', 'hand_balance'],
    verified: true,
    how_to_apply: 'Audiciones abiertas periódicas. Ver su web para convocatorias.',
  },
  {
    id: 'd103', name: 'Close-Act Theatre — Países Bajos', venue_type: 'production_company',
    country: 'Países Bajos', region: 'Europa',
    description: 'Compañía neerlandesa de teatro de calle y artes escénicas en exteriores. Fundada en 1993. Espectáculos con zancos, aeriales y teatro visual para festivales y espacios públicos en todo el mundo. Muy activos en Europa y Asia.',
    email: 'casting@close-act.nl', website: 'https://www.close-act.nl',
    contact_name: 'Casting Department',
    disciplines: ['stilts', 'aerial_silk', 'acrobatics', 'dancing', 'street_performance'],
    verified: true,
    how_to_apply: 'Audiciones periódicas. Enviá CV + fotos + video a casting@close-act.nl.',
  },
];

const REGIONS = ['Todas', 'Europa', 'América Latina', 'América del Norte', 'Asia', 'Global'];

export default function DirectorioScreen() {
  const [search, setSearch] = useState('');
  const [activeVenueType, setActiveVenueType] = useState('all');
  const [activeRegion, setActiveRegion] = useState('Todas');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [activeDiscipline, setActiveDiscipline] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = DIRECTORY.filter(c => {
    if (activeVenueType !== 'all' && c.venue_type !== activeVenueType) return false;
    if (activeRegion !== 'Todas' && c.region !== activeRegion) return false;
    if (activeDiscipline && !c.disciplines.includes(activeDiscipline)) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.country.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (selected) {
    return <ContactDetail contact={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Directorio</Text>
        <Text style={styles.subtitle}>Venues, festivales y productoras</Text>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o país..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={COLORS.textMuted}
        />
      </View>

      {/* Filters — collapsible */}
      {(() => {
        const activeCount = (activeRegion !== 'Todas' ? 1 : 0) + (activeVenueType !== 'all' ? 1 : 0) + (activeDiscipline ? 1 : 0);
        const vt = VENUE_TYPES.find(v => v.id === activeVenueType);
        const disc = DISCIPLINES.find(d => d.id === activeDiscipline);
        return (
          <View style={styles.filtersSection}>
            {/* Header row */}
            <TouchableOpacity style={styles.filterToggleRow} onPress={() => setFiltersOpen(v => !v)} activeOpacity={0.7}>
              <View style={styles.filterToggleLeft}>
                <Text style={styles.filterToggleLabel}>Filtros</Text>
                {activeCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeCount}</Text>
                  </View>
                )}
                {/* Active filter pills when collapsed */}
                {!filtersOpen && activeCount > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row', gap: 4 }}>
                    {activeRegion !== 'Todas' && <Text style={styles.activeFilterPill}>{activeRegion}</Text>}
                    {vt && <Text style={styles.activeFilterPill}>{vt.emoji} {vt.label}</Text>}
                    {disc && <Text style={styles.activeFilterPill}>{disc.label}</Text>}
                  </ScrollView>
                )}
              </View>
              <View style={styles.filterToggleRight}>
                {activeCount > 0 && (
                  <TouchableOpacity onPress={() => { setActiveRegion('Todas'); setActiveVenueType('all'); setActiveDiscipline(''); }} style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>Limpiar</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.filterArrow}>{filtersOpen ? '▲' : '▼'}</Text>
              </View>
            </TouchableOpacity>

            {/* Expandable content */}
            {filtersOpen && (
              <View style={styles.filterBody}>
                <Text style={styles.filterLabel}>Región</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
                  {REGIONS.map(r => (
                    <TouchableOpacity key={r} style={[styles.chip, activeRegion === r && styles.chipActive]} onPress={() => setActiveRegion(r)}>
                      <Text style={[styles.chipText, activeRegion === r && styles.chipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.filterLabel, { marginTop: SPACING.sm }]}>Tipo de venue</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
                  <TouchableOpacity style={[styles.chip, activeVenueType === 'all' && styles.chipActive]} onPress={() => setActiveVenueType('all')}>
                    <Text style={[styles.chipText, activeVenueType === 'all' && styles.chipTextActive]}>Todos</Text>
                  </TouchableOpacity>
                  {VENUE_TYPES.map(v => (
                    <TouchableOpacity key={v.id} style={[styles.chip, activeVenueType === v.id && styles.chipActive]} onPress={() => setActiveVenueType(v.id)}>
                      <Text style={[styles.chipText, activeVenueType === v.id && styles.chipTextActive]}>{v.emoji} {v.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.filterLabel, { marginTop: SPACING.sm }]}>Disciplina</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
                  <TouchableOpacity style={[styles.chip, activeDiscipline === '' && styles.chipActive]} onPress={() => setActiveDiscipline('')}>
                    <Text style={[styles.chipText, activeDiscipline === '' && styles.chipTextActive]}>Todas</Text>
                  </TouchableOpacity>
                  {DISCIPLINES.map(d => (
                    <TouchableOpacity key={d.id} style={[styles.chip, activeDiscipline === d.id && styles.chipActive]} onPress={() => setActiveDiscipline(v => v === d.id ? '' : d.id)}>
                      <Text style={[styles.chipText, activeDiscipline === d.id && styles.chipTextActive]}>{d.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        );
      })()}

      <Text style={styles.count}>{filtered.length} contactos</Text>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const vt = VENUE_TYPES.find(v => v.id === item.venue_type);
          return (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.85}>
              <View style={styles.cardHeader}>
                <View style={styles.venueTag}>
                  <Text style={styles.venueEmoji}>{vt?.emoji}</Text>
                  <Text style={styles.venueType}>{vt?.label}</Text>
                </View>
                {item.verified && <Text style={styles.verified}>✓ Verificado</Text>}
              </View>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardLocation}>📍 {item.country} · {item.region}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              <View style={styles.cardFooter}>
                {item.email && <Text style={styles.contactBadge}>✉️ Email</Text>}
                {item.website && <Text style={styles.contactBadge}>🌐 Web</Text>}
                {item.facebook && <Text style={styles.contactBadge}>👥 Facebook</Text>}
                <Text style={styles.tapMore}>Ver cómo aplicar →</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🗂️</Text>
            <Text style={styles.emptyText}>No hay resultados para esta búsqueda</Text>
          </View>
        }
      />
    </View>
  );
}

function ContactDetail({ contact, onBack }: { contact: Contact; onBack: () => void }) {
  const vt = VENUE_TYPES.find(v => v.id === contact.venue_type);
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('artist_profiles').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user?.id]);

  function buildProfileText() {
    const lines: string[] = [];
    const name = profile?.display_name || user?.email?.split('@')[0] || '';
    const greeting = contact.contact_name
      ? `Hola ${contact.contact_name},`
      : `Hola equipo de ${contact.name},`;
    lines.push(greeting);
    lines.push('');
    lines.push(`Mi nombre es ${name} y me pongo en contacto para presentarme como artista.`);
    lines.push('');
    if (profile?.bio) { lines.push(profile.bio); lines.push(''); }
    if (profile?.disciplines?.length) {
      const labels = profile.disciplines
        .map((d: string) => DISCIPLINES.find(x => x.id === d)?.label ?? d)
        .join(', ');
      lines.push(`Disciplinas: ${labels}.`);
    }
    if (profile?.experience_years) lines.push(`Experiencia: ${profile.experience_years} años.`);
    if (profile?.city || profile?.country)
      lines.push(`Ubicación: ${[profile.city, profile.country].filter(Boolean).join(', ')}.`);
    if (profile?.languages?.length)
      lines.push(`Idiomas: ${profile.languages.join(', ')}.`);
    lines.push('');
    lines.push('─────────────────────');
    if (user?.id) lines.push(`Mi perfil en ArtNet: https://artnet-circus.vercel.app/artista/${user.id}`);
    if (profile?.instagram_handle) lines.push(`Instagram: https://instagram.com/${profile.instagram_handle}`);
    if (profile?.website_url) lines.push(`Web: ${profile.website_url}`);
    if (profile?.youtube_url) lines.push(`Showreel: ${profile.youtube_url}`);
    lines.push('─────────────────────');
    lines.push('');
    lines.push('Quedo a disposición para cualquier consulta o audición.');
    lines.push('');
    lines.push(`Saludos,\n${name}`);
    return lines.join('\n');
  }

  function sendEmail() {
    if (!contact.email) return;
    const name = profile?.display_name || user?.email?.split('@')[0] || 'Artista';
    const subject = encodeURIComponent(`Presentación artística — ${name}`);
    const body = encodeURIComponent(buildProfileText());
    Linking.openURL(`mailto:${contact.email}?subject=${subject}&body=${body}`);
  }

  function copyProfile() {
    Clipboard.setString(buildProfileText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.detailContent}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Directorio</Text>
      </TouchableOpacity>

      <View style={styles.venueTag}>
        <Text style={styles.venueEmoji}>{vt?.emoji}</Text>
        <Text style={styles.venueType}>{vt?.label}</Text>
        {contact.verified && <Text style={styles.verified}> ✓ Verificado</Text>}
      </View>

      <Text style={styles.detailName}>{contact.name}</Text>
      <Text style={styles.cardLocation}>📍 {contact.country} · {contact.region}</Text>

      <Text style={styles.sectionTitle}>Sobre ellos</Text>
      <Text style={styles.body}>{contact.description}</Text>

      {contact.how_to_apply && (
        <>
          <Text style={styles.sectionTitle}>Cómo postularse</Text>
          <View style={styles.howToCard}>
            <Text style={styles.howToEmoji}>📋</Text>
            <Text style={styles.howToText}>{contact.how_to_apply}</Text>
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Contacto</Text>
      <View style={styles.contactCard}>
        {contact.contact_name && (
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Persona</Text>
            <Text style={styles.contactValue}>{contact.contact_name}{contact.contact_title ? ` — ${contact.contact_title}` : ''}</Text>
          </View>
        )}
        {contact.email && (
          <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${contact.email}`)}>
            <Text style={styles.contactLabel}>Email</Text>
            <Text style={[styles.contactValue, styles.link]}>{contact.email}</Text>
          </TouchableOpacity>
        )}
        {contact.website && (
          <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(contact.website!)}>
            <Text style={styles.contactLabel}>Web</Text>
            <Text style={[styles.contactValue, styles.link]}>{contact.website}</Text>
          </TouchableOpacity>
        )}
        {contact.facebook && (
          <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(contact.facebook!)}>
            <Text style={styles.contactLabel}>Facebook</Text>
            <Text style={[styles.contactValue, styles.link]}>Ver página</Text>
          </TouchableOpacity>
        )}
        {contact.instagram && (
          <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(contact.instagram!)}>
            <Text style={styles.contactLabel}>Instagram</Text>
            <Text style={[styles.contactValue, styles.link]}>{contact.instagram}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Enviar perfil — solo si hay email */}
      {contact.email && (
        <>
          <Text style={styles.sectionTitle}>Enviar mi perfil</Text>
          <View style={styles.profilePreview}>
            <Text style={styles.profilePreviewText} numberOfLines={6}>
              {buildProfileText()}
            </Text>
            <TouchableOpacity onPress={copyProfile} style={styles.copyHint}>
              <Text style={styles.copyHintText}>{copied ? '✓ Copiado' : 'Tocar para copiar el texto'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.sendBtn} onPress={sendEmail} activeOpacity={0.85}>
            <Text style={styles.sendBtnText}>Enviar mi perfil por email →</Text>
          </TouchableOpacity>
          {(!profile?.bio && !profile?.instagram_handle) && (
            <Text style={styles.profileTip}>
              Completá tu perfil para que el email incluya tu bio, disciplinas y links.
            </Text>
          )}
        </>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.xl, paddingTop: HEADER_TOP, paddingBottom: SPACING.sm },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, marginHorizontal: SPACING.xl, marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.base, borderWidth: 1.5, borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 16, marginRight: SPACING.sm },
  searchInput: { flex: 1, padding: SPACING.base, fontSize: 16, color: COLORS.text },
  filtersSection: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.sm,
  },
  filterToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, gap: SPACING.sm,
  },
  filterToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  filterToggleLabel: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
  filterBadge: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    width: 18, height: 18, justifyContent: 'center', alignItems: 'center',
  },
  filterBadgeText: { fontSize: 10, color: COLORS.white, fontWeight: '800' },
  activeFilterPill: {
    fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600',
    backgroundColor: '#EDE9FE', borderRadius: RADIUS.full,
    paddingVertical: 2, paddingHorizontal: 8,
  },
  filterToggleRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  clearBtn: { paddingVertical: 2, paddingHorizontal: 6 },
  clearBtnText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  filterArrow: { fontSize: 10, color: COLORS.textMuted },
  filterBody: { paddingTop: SPACING.xs, paddingBottom: SPACING.sm },
  filterLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.xl,
    marginBottom: 6,
    marginTop: 2,
  },
  filterScroll: { height: 38 },
  filterContent: { paddingHorizontal: SPACING.xl, gap: SPACING.sm, alignItems: 'center' },
  chip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingVertical: 6, paddingHorizontal: SPACING.md, backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '500' },
  chipTextActive: { color: COLORS.white, fontWeight: '700' },
  count: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, paddingHorizontal: SPACING.xl, marginTop: SPACING.sm, marginBottom: SPACING.sm, fontWeight: '500' },
  list: { paddingHorizontal: SPACING.xl, paddingBottom: 100, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.base,
    borderWidth: 1, borderColor: COLORS.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  venueTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  venueEmoji: { fontSize: 14 },
  venueType: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  verified: { fontSize: FONTS.sizes.xs, color: COLORS.success ?? '#10B981', fontWeight: '700' },
  cardName: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  cardLocation: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  cardDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 19, marginBottom: SPACING.sm },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, alignItems: 'center' },
  contactBadge: {
    fontSize: FONTS.sizes.xs, backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.full, paddingVertical: 3, paddingHorizontal: SPACING.sm,
    color: COLORS.textSecondary, fontWeight: '500',
  },
  tapMore: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '700', marginLeft: 'auto' },
  empty: { alignItems: 'center', marginTop: 60, gap: SPACING.md },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, textAlign: 'center' },
  // Detail styles
  detailContent: { padding: SPACING.xl },
  backBtn: { marginBottom: SPACING.xl },
  backText: { color: COLORS.primary, fontSize: FONTS.sizes.base, fontWeight: '600' },
  detailName: { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text, marginTop: SPACING.sm, marginBottom: SPACING.xs },
  sectionTitle: { fontSize: FONTS.sizes.xs, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  body: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, lineHeight: 24 },
  howToCard: { flexDirection: 'row', gap: SPACING.sm, backgroundColor: '#FFF7ED', borderRadius: RADIUS.lg, padding: SPACING.base, borderWidth: 1, borderColor: '#FED7AA' },
  howToEmoji: { fontSize: 20 },
  howToText: { flex: 1, fontSize: FONTS.sizes.sm, color: '#C2410C', lineHeight: 20 },
  contactCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderLight },
  contactRow: { flexDirection: 'row', padding: SPACING.base, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, gap: SPACING.md },
  contactLabel: { width: 80, fontSize: FONTS.sizes.sm, color: COLORS.textMuted, fontWeight: '600' },
  contactValue: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '500' },
  link: { color: COLORS.primary },
  // Send profile
  profilePreview: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.base, borderWidth: 1, borderColor: COLORS.borderLight,
    marginBottom: SPACING.sm,
  },
  profilePreviewText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, lineHeight: 18 },
  copyHint: { marginTop: SPACING.sm, alignItems: 'flex-end' },
  copyHintText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  sendBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: SPACING.base, alignItems: 'center',
  },
  sendBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONTS.sizes.base },
  profileTip: {
    fontSize: FONTS.sizes.xs, color: COLORS.textMuted,
    textAlign: 'center', marginTop: SPACING.sm, lineHeight: 16,
  },
});
