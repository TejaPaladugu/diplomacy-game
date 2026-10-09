// Standard Diplomacy map data (classic 1900 Europe board, 4th edition rules).
// 75 provinces total: 56 land (34 supply centers + 22 non-SC) + 19 sea zones.
// Coordinates are an approximate stylized layout (1400x1000 viewBox) for the 2D map,
// not a literal trace of the printed board.

export type Power = 'ENGLAND' | 'FRANCE' | 'GERMANY' | 'ITALY' | 'AUSTRIA' | 'RUSSIA' | 'TURKEY';

export const POWERS: Power[] = ['ENGLAND', 'FRANCE', 'GERMANY', 'ITALY', 'AUSTRIA', 'RUSSIA', 'TURKEY'];

export type ProvinceType = 'land' | 'sea';

// Coast suffixes used only by the three split-coast provinces.
export type CoastId = 'nc' | 'sc' | 'ec';

export interface Province {
  id: string; // lowercase 3-letter code
  name: string;
  type: ProvinceType;
  supplyCenter: boolean;
  home?: Power;
  coastal: boolean; // land provinces only: can a fleet ever be here
  coasts?: CoastId[]; // split-coast land provinces only (spa, bul, stp)
  armyAdjacent: string[]; // province ids reachable by Army
  // Fleet adjacency. For provinces without a coast split this is a flat list
  // under key 'single'. For split-coast provinces, one list per coast.
  fleetAdjacent: Record<string, string[]>;
  x: number;
  y: number;
}

function land(
  id: string,
  name: string,
  opts: {
    supplyCenter?: boolean;
    home?: Power;
    coastal?: boolean;
    coasts?: CoastId[];
    army: string[];
    fleet?: string[] | Record<string, string[]>;
    x: number;
    y: number;
  },
): Province {
  const fleetAdjacent: Record<string, string[]> = {};
  if (opts.coasts) {
    const f = opts.fleet as Record<string, string[]>;
    for (const c of opts.coasts) fleetAdjacent[c] = f[c] ?? [];
  } else if (opts.coastal) {
    fleetAdjacent.single = (opts.fleet as string[]) ?? [];
  }
  return {
    id,
    name,
    type: 'land',
    supplyCenter: !!opts.supplyCenter,
    home: opts.home,
    coastal: !!opts.coastal,
    coasts: opts.coasts,
    armyAdjacent: opts.army,
    fleetAdjacent,
    x: opts.x,
    y: opts.y,
  };
}

function sea(id: string, name: string, adj: string[], x: number, y: number): Province {
  return {
    id,
    name,
    type: 'sea',
    supplyCenter: false,
    coastal: false,
    armyAdjacent: [],
    fleetAdjacent: { single: adj },
    x,
    y,
  };
}

export const PROVINCES: Record<string, Province> = {};
function add(p: Province) {
  PROVINCES[p.id] = p;
}

// ---------------------------------------------------------------- England --
add(land('edi', 'Edinburgh', { supplyCenter: true, home: 'ENGLAND', coastal: true, army: ['cly', 'lvp', 'yor'], fleet: ['cly', 'nth', 'nwg', 'yor'], x: 520, y: 90 }));
add(land('lvp', 'Liverpool', { supplyCenter: true, home: 'ENGLAND', coastal: true, army: ['cly', 'edi', 'wal', 'yor'], fleet: ['cly', 'iri', 'nao', 'wal'], x: 470, y: 150 }));
add(land('lon', 'London', { supplyCenter: true, home: 'ENGLAND', coastal: true, army: ['wal', 'yor'], fleet: ['eng', 'nth', 'wal', 'yor'], x: 560, y: 250 }));
add(land('wal', 'Wales', { coastal: true, army: ['lvp', 'lon', 'yor'], fleet: ['eng', 'iri', 'lvp', 'lon'], x: 490, y: 230 }));
add(land('yor', 'Yorkshire', { coastal: true, army: ['edi', 'lvp', 'lon', 'wal'], fleet: ['edi', 'lon', 'nth'], x: 540, y: 170 }));
add(land('cly', 'Clyde', { coastal: true, army: ['edi', 'lvp'], fleet: ['edi', 'lvp', 'nao', 'nwg'], x: 460, y: 80 }));

// ----------------------------------------------------------------- France --
add(land('bre', 'Brest', { supplyCenter: true, home: 'FRANCE', coastal: true, army: ['gas', 'par', 'pic'], fleet: ['eng', 'gas', 'mao', 'pic'], x: 470, y: 340 }));
add(land('par', 'Paris', { supplyCenter: true, home: 'FRANCE', coastal: false, army: ['bre', 'bur', 'gas', 'pic'], x: 540, y: 340 }));
add(land('pic', 'Picardy', { coastal: true, army: ['bel', 'bre', 'bur', 'par'], fleet: ['bel', 'eng', 'bre'], x: 540, y: 300 }));
add(land('bur', 'Burgundy', { coastal: false, army: ['bel', 'gas', 'mar', 'mun', 'par', 'pic', 'ruh'], x: 580, y: 350 }));
add(land('gas', 'Gascony', { coastal: true, army: ['bre', 'bur', 'mar', 'par', 'spa'], fleet: ['bre', 'mao', 'spa:nc'], x: 500, y: 400 }));
add(land('mar', 'Marseilles', { supplyCenter: true, home: 'FRANCE', coastal: true, army: ['bur', 'gas', 'pie', 'spa'], fleet: ['lyo', 'pie', 'spa:sc'], x: 570, y: 420 }));

// --------------------------------------------------------------- Germany --
add(land('kie', 'Kiel', { supplyCenter: true, home: 'GERMANY', coastal: true, army: ['ber', 'den', 'hol', 'mun', 'ruh'], fleet: ['bal', 'ber', 'den', 'hel', 'hol'], x: 650, y: 230 }));
add(land('ber', 'Berlin', { supplyCenter: true, home: 'GERMANY', coastal: true, army: ['kie', 'mun', 'pru', 'sil'], fleet: ['bal', 'kie', 'pru'], x: 690, y: 230 }));
add(land('mun', 'Munich', { supplyCenter: true, home: 'GERMANY', coastal: false, army: ['ber', 'boh', 'bur', 'kie', 'ruh', 'sil', 'tyr'], x: 650, y: 300 }));
add(land('ruh', 'Ruhr', { coastal: false, army: ['bel', 'bur', 'kie', 'mun', 'hol'], x: 600, y: 280 }));
add(land('pru', 'Prussia', { coastal: true, army: ['ber', 'lvn', 'sil', 'war'], fleet: ['bal', 'ber', 'lvn'], x: 730, y: 230 }));
add(land('sil', 'Silesia', { coastal: false, army: ['ber', 'boh', 'gal', 'mun', 'pru', 'war'], x: 700, y: 270 }));
add(land('hol', 'Holland', { supplyCenter: true, coastal: true, army: ['bel', 'kie', 'ruh'], fleet: ['bel', 'hel', 'kie', 'nth'], x: 600, y: 240 }));
add(land('bel', 'Belgium', { supplyCenter: true, coastal: true, army: ['bur', 'hol', 'pic', 'ruh'], fleet: ['eng', 'hol', 'nth', 'pic'], x: 570, y: 270 }));
add(land('den', 'Denmark', { supplyCenter: true, coastal: true, army: ['kie', 'swe'], fleet: ['bal', 'hel', 'kie', 'nth', 'ska', 'swe'], x: 660, y: 170 }));

// ---------------------------------------------------------------- Italy --
add(land('ven', 'Venice', { supplyCenter: true, home: 'ITALY', coastal: true, army: ['apu', 'pie', 'rom', 'tri', 'tus', 'tyr'], fleet: ['adr', 'apu', 'tri'], x: 670, y: 400 }));
add(land('rom', 'Rome', { supplyCenter: true, home: 'ITALY', coastal: true, army: ['apu', 'nap', 'tus', 'ven'], fleet: ['nap', 'tus', 'tys'], x: 660, y: 450 }));
add(land('nap', 'Naples', { supplyCenter: true, home: 'ITALY', coastal: true, army: ['apu', 'rom'], fleet: ['apu', 'ion', 'rom', 'tys'], x: 690, y: 490 }));
add(land('pie', 'Piedmont', { coastal: true, army: ['mar', 'tus', 'tyr', 'ven'], fleet: ['lyo', 'mar', 'tus'], x: 610, y: 390 }));
add(land('tus', 'Tuscany', { coastal: true, army: ['pie', 'rom', 'ven'], fleet: ['lyo', 'pie', 'rom', 'tys'], x: 640, y: 420 }));
add(land('apu', 'Apulia', { coastal: true, army: ['nap', 'rom', 'ven'], fleet: ['adr', 'ion', 'nap', 'ven'], x: 710, y: 460 }));
add(land('tyr', 'Tyrolia', { coastal: false, army: ['boh', 'mun', 'pie', 'tri', 'ven', 'vie'], x: 640, y: 350 }));

// ----------------------------------------------------------- Austria-Hungary --
add(land('vie', 'Vienna', { supplyCenter: true, home: 'AUSTRIA', coastal: false, army: ['boh', 'bud', 'gal', 'tri', 'tyr'], x: 700, y: 330 }));
add(land('bud', 'Budapest', { supplyCenter: true, home: 'AUSTRIA', coastal: false, army: ['gal', 'rum', 'ser', 'tri', 'vie'], x: 740, y: 340 }));
add(land('tri', 'Trieste', { supplyCenter: true, home: 'AUSTRIA', coastal: true, army: ['alb', 'bud', 'ser', 'tyr', 'ven', 'vie'], fleet: ['adr', 'alb', 'ven'], x: 690, y: 380 }));
add(land('boh', 'Bohemia', { coastal: false, army: ['gal', 'mun', 'sil', 'tyr', 'vie'], x: 680, y: 290 }));
add(land('gal', 'Galicia', { coastal: false, army: ['boh', 'bud', 'rum', 'sil', 'ukr', 'vie', 'war'], x: 750, y: 290 }));

// -------------------------------------------------------------------- Russia --
add(
  land('stp', 'St Petersburg', {
    supplyCenter: true,
    home: 'RUSSIA',
    coastal: true,
    coasts: ['nc', 'sc'],
    army: ['fin', 'lvn', 'mos', 'nwy'],
    fleet: { nc: ['bar', 'nwy'], sc: ['bot', 'fin', 'lvn'] },
    x: 820,
    y: 80,
  }),
);
add(land('mos', 'Moscow', { supplyCenter: true, home: 'RUSSIA', coastal: false, army: ['lvn', 'sev', 'stp', 'ukr', 'war'], x: 840, y: 180 }));
add(land('war', 'Warsaw', { supplyCenter: true, home: 'RUSSIA', coastal: false, army: ['gal', 'lvn', 'mos', 'pru', 'sil', 'ukr'], x: 760, y: 230 }));
add(land('sev', 'Sevastopol', { supplyCenter: true, home: 'RUSSIA', coastal: true, army: ['arm', 'mos', 'rum', 'ukr'], fleet: ['arm', 'bla', 'rum'], x: 850, y: 320 }));
add(land('lvn', 'Livonia', { coastal: true, army: ['mos', 'pru', 'stp', 'war'], fleet: ['bal', 'bot', 'pru', 'stp:sc'], x: 780, y: 170 }));
add(land('ukr', 'Ukraine', { coastal: false, army: ['gal', 'mos', 'rum', 'sev', 'war'], x: 800, y: 260 }));
add(land('fin', 'Finland', { coastal: true, army: ['nwy', 'stp', 'swe'], fleet: ['bot', 'stp:sc', 'swe'], x: 760, y: 100 }));

// -------------------------------------------------------------- Scandinavia --
add(land('nwy', 'Norway', { supplyCenter: true, coastal: true, army: ['fin', 'stp', 'swe'], fleet: ['bar', 'nth', 'nwg', 'ska', 'stp:nc', 'swe'], x: 660, y: 70 }));
add(land('swe', 'Sweden', { supplyCenter: true, coastal: true, army: ['den', 'fin', 'nwy'], fleet: ['bal', 'den', 'fin', 'bot', 'nwy', 'ska'], x: 700, y: 110 }));

// -------------------------------------------------------------------- Iberia --
add(
  land('spa', 'Spain', {
    supplyCenter: true,
    coastal: true,
    coasts: ['nc', 'sc'],
    army: ['gas', 'mar', 'por'],
    fleet: { nc: ['gas', 'mao', 'por'], sc: ['mar', 'mao', 'por', 'wes', 'lyo'] },
    x: 480,
    y: 460,
  }),
);
add(land('por', 'Portugal', { supplyCenter: true, coastal: true, army: ['spa'], fleet: ['mao', 'spa:nc', 'spa:sc'], x: 420, y: 460 }));

// -------------------------------------------------------------- North Africa --
add(land('naf', 'North Africa', { coastal: true, army: ['tun'], fleet: ['mao', 'tun', 'wes'], x: 500, y: 560 }));
add(land('tun', 'Tunis', { supplyCenter: true, coastal: true, army: ['naf'], fleet: ['ion', 'naf', 'tys', 'wes'], x: 610, y: 560 }));

// ------------------------------------------------------------------ Balkans --
add(land('ser', 'Serbia', { supplyCenter: true, coastal: false, army: ['alb', 'bud', 'bul', 'gre', 'rum', 'tri'], x: 730, y: 400 }));
add(land('alb', 'Albania', { coastal: true, army: ['gre', 'ser', 'tri'], fleet: ['adr', 'gre', 'ion', 'tri'], x: 710, y: 430 }));
add(land('gre', 'Greece', { supplyCenter: true, coastal: true, army: ['alb', 'bul', 'ser'], fleet: ['aeg', 'alb', 'bul:sc', 'ion'], x: 740, y: 470 }));
add(
  land('bul', 'Bulgaria', {
    supplyCenter: true,
    coastal: true,
    coasts: ['ec', 'sc'],
    army: ['con', 'gre', 'rum', 'ser'],
    fleet: { ec: ['bla', 'con', 'rum'], sc: ['aeg', 'con', 'gre'] },
    x: 790,
    y: 420,
  }),
);
add(land('rum', 'Rumania', { supplyCenter: true, coastal: true, army: ['bud', 'bul', 'gal', 'ser', 'sev', 'ukr'], fleet: ['bla', 'bul:ec', 'sev'], x: 800, y: 350 }));

// ------------------------------------------------------------------- Turkey --
add(land('con', 'Constantinople', { supplyCenter: true, home: 'TURKEY', coastal: true, army: ['ank', 'bul', 'smy'], fleet: ['aeg', 'ank', 'bla', 'bul:ec', 'bul:sc', 'smy'], x: 830, y: 450 }));
add(land('ank', 'Ankara', { supplyCenter: true, home: 'TURKEY', coastal: true, army: ['arm', 'con', 'smy'], fleet: ['arm', 'bla', 'con'], x: 880, y: 430 }));
add(land('smy', 'Smyrna', { supplyCenter: true, home: 'TURKEY', coastal: true, army: ['ank', 'arm', 'con', 'syr'], fleet: ['aeg', 'con', 'eas', 'syr'], x: 850, y: 490 }));
add(land('arm', 'Armenia', { coastal: true, army: ['ank', 'sev', 'smy', 'syr'], fleet: ['ank', 'bla', 'sev'], x: 930, y: 440 }));
add(land('syr', 'Syria', { coastal: true, army: ['arm', 'smy'], fleet: ['eas', 'smy'], x: 900, y: 500 }));

// ------------------------------------------------------------- Sea provinces --
add(sea('nao', 'North Atlantic Ocean', ['cly', 'iri', 'lvp', 'mao', 'nwg'], 380, 90));
add(sea('nwg', 'Norwegian Sea', ['bar', 'cly', 'edi', 'nao', 'nth', 'nwy'], 460, 30));
add(sea('bar', 'Barents Sea', ['nwy', 'nwg', 'stp:nc'], 780, 10));
add(sea('nth', 'North Sea', ['bel', 'den', 'edi', 'eng', 'hel', 'hol', 'lon', 'nwy', 'nwg', 'ska', 'yor'], 560, 170));
add(sea('eng', 'English Channel', ['bel', 'bre', 'iri', 'lon', 'mao', 'nth', 'pic', 'wal'], 500, 290));
add(sea('iri', 'Irish Sea', ['eng', 'lvp', 'mao', 'nao', 'wal'], 420, 220));
add(sea('mao', 'Mid-Atlantic Ocean', ['bre', 'eng', 'gas', 'iri', 'naf', 'nao', 'por', 'spa:nc', 'spa:sc', 'wes'], 400, 350));
add(sea('wes', 'Western Mediterranean', ['lyo', 'mao', 'naf', 'spa:sc', 'tun', 'tys'], 530, 500));
add(sea('lyo', 'Gulf of Lyon', ['mar', 'pie', 'spa:sc', 'tus', 'tys', 'wes'], 580, 460));
add(sea('tys', 'Tyrrhenian Sea', ['lyo', 'ion', 'nap', 'rom', 'tun', 'tus', 'wes'], 620, 500));
add(sea('ion', 'Ionian Sea', ['adr', 'aeg', 'alb', 'apu', 'eas', 'gre', 'nap', 'tun', 'tys'], 700, 520));
add(sea('adr', 'Adriatic Sea', ['alb', 'apu', 'ion', 'tri', 'ven'], 690, 430));
add(sea('aeg', 'Aegean Sea', ['bul:sc', 'con', 'eas', 'gre', 'ion', 'smy'], 800, 480));
add(sea('eas', 'Eastern Mediterranean', ['aeg', 'ion', 'smy', 'syr'], 850, 530));
add(sea('bla', 'Black Sea', ['ank', 'arm', 'bul:ec', 'con', 'rum', 'sev'], 850, 370));
add(sea('bal', 'Baltic Sea', ['ber', 'bot', 'den', 'kie', 'lvn', 'pru', 'swe'], 710, 190));
add(sea('bot', 'Gulf of Bothnia', ['bal', 'fin', 'lvn', 'stp:sc', 'swe'], 740, 140));
add(sea('ska', 'Skagerrak', ['den', 'nth', 'nwy', 'swe'], 650, 140));
add(sea('hel', 'Helgoland Bight', ['den', 'hol', 'kie', 'nth'], 610, 200));

// ----------------------------------------------------------------- Validate --
// Every army edge and every fleet edge (at the province level, ignoring which
// specific sub-coast) must be symmetric. Thrown at module load so a mistake
// fails fast instead of producing silently-wrong adjudication later.
function baseId(ref: string): string {
  return ref.split(':')[0];
}

function validate() {
  const errors: string[] = [];
  for (const p of Object.values(PROVINCES)) {
    for (const nb of p.armyAdjacent) {
      const target = PROVINCES[nb];
      if (!target) {
        errors.push(`${p.id}: army-adjacent to unknown province ${nb}`);
        continue;
      }
      if (!target.armyAdjacent.includes(p.id)) {
        errors.push(`Army adjacency not symmetric: ${p.id} -> ${nb} but not back`);
      }
    }
    for (const coast of Object.keys(p.fleetAdjacent)) {
      for (const nbRef of p.fleetAdjacent[coast]) {
        const nbId = baseId(nbRef);
        const target = PROVINCES[nbId];
        if (!target) {
          errors.push(`${p.id}(${coast}): fleet-adjacent to unknown province ${nbRef}`);
          continue;
        }
        const targetCoasts = target.coasts ? Object.keys(target.fleetAdjacent) : ['single'];
        const backRef = p.coasts ? `${p.id}:${coast}` : p.id;
        const hasBack = targetCoasts.some((tc) => (target.fleetAdjacent[tc] || []).some((r) => r === backRef || r === p.id));
        if (!hasBack) {
          errors.push(`Fleet adjacency not symmetric: ${p.id}(${coast}) -> ${nbRef} but not back`);
        }
      }
    }
  }
  const scCount = Object.values(PROVINCES).filter((p) => p.supplyCenter).length;
  if (scCount !== 34) errors.push(`Expected 34 supply centers, found ${scCount}`);
  const total = Object.keys(PROVINCES).length;
  if (total !== 75) errors.push(`Expected 75 provinces, found ${total}`);
  if (errors.length) {
    throw new Error(`Map data validation failed:\n${errors.join('\n')}`);
  }
}

validate();
