import { describe, expect, it } from 'vitest';
import { adjudicateMovement } from '../adjudicator.js';
import { A, F, convoy, hold, move, supportHold, supportMove } from './testUtils.js';

function finalOf(result: ReturnType<typeof adjudicateMovement>, origProvince: string) {
  return result.resolved.find((r) => r.order.unit.province === origProvince)!;
}

describe('basic movement', () => {
  it('diagram 1: simple unopposed army move', () => {
    const units = [A('FRANCE', 'par')];
    const res = adjudicateMovement(units, [move('par', 'bur')]);
    expect(finalOf(res, 'par').outcome).toBe('succeeded');
    expect(res.units.find((u) => u.power === 'FRANCE')!.province).toBe('bur');
  });

  it('diagram 4: equal-strength standoff leaves both in place', () => {
    const units = [A('GERMANY', 'ber'), A('RUSSIA', 'war')];
    const res = adjudicateMovement(units, [move('ber', 'sil'), move('war', 'sil')]);
    expect(finalOf(res, 'ber').outcome).toBe('bounced');
    expect(finalOf(res, 'war').outcome).toBe('bounced');
  });

  it('diagram 5: a holding unit blocks two attackers from trading', () => {
    const units = [F('GERMANY', 'kie'), A('GERMANY', 'ber'), A('RUSSIA', 'pru')];
    const res = adjudicateMovement(units, [move('kie', 'ber'), move('ber', 'pru'), hold('pru')]);
    expect(finalOf(res, 'kie').outcome).toBe('bounced');
    expect(finalOf(res, 'ber').outcome).toBe('bounced');
    expect(finalOf(res, 'pru').outcome).toBe('succeeded');
  });

  it('diagram 6: direct swap without convoy never happens', () => {
    const units = [F('GERMANY', 'ber'), A('GERMANY', 'pru')];
    const res = adjudicateMovement(units, [move('ber', 'pru'), move('pru', 'ber')]);
    expect(finalOf(res, 'ber').outcome).toBe('bounced');
    expect(finalOf(res, 'pru').outcome).toBe('bounced');
  });

  it('diagram 7: three units can rotate', () => {
    const units = [A('ENGLAND', 'hol'), F('ENGLAND', 'bel'), F('FRANCE', 'nth')];
    const res = adjudicateMovement(units, [move('hol', 'bel'), move('bel', 'nth'), move('nth', 'hol')]);
    expect(finalOf(res, 'hol').outcome).toBe('succeeded');
    expect(finalOf(res, 'bel').outcome).toBe('succeeded');
    expect(finalOf(res, 'nth').outcome).toBe('succeeded');
    const prov = (power: string) => res.units.find((u) => u.power === power)!.province;
    expect(prov('ENGLAND')).toBe('bel'); // the army, originally in Hol
  });
});

describe('support', () => {
  it('diagram 8: simple support dislodges', () => {
    const units = [A('FRANCE', 'mar'), A('FRANCE', 'gas'), A('GERMANY', 'bur')];
    const res = adjudicateMovement(units, [move('mar', 'bur'), supportMove('gas', 'mar', 'bur'), hold('bur')]);
    expect(finalOf(res, 'mar').outcome).toBe('succeeded');
    expect(finalOf(res, 'bur').outcome).toBe('dislodged');
  });

  it('diagram 9: supporter need not be adjacent to the supported unit', () => {
    const units = [A('GERMANY', 'sil'), F('GERMANY', 'bal'), A('RUSSIA', 'pru')];
    const res = adjudicateMovement(units, [move('sil', 'pru'), supportMove('bal', 'sil', 'pru'), hold('pru')]);
    expect(finalOf(res, 'sil').outcome).toBe('succeeded');
    expect(finalOf(res, 'pru').outcome).toBe('dislodged');
  });

  it('diagram 15: support cut by an attack from a non-target province', () => {
    const units = [A('GERMANY', 'pru'), A('GERMANY', 'sil'), A('RUSSIA', 'war'), A('RUSSIA', 'boh')];
    const res = adjudicateMovement(units, [
      move('pru', 'war'),
      supportMove('sil', 'pru', 'war'),
      hold('war'),
      move('boh', 'sil'),
    ]);
    expect(finalOf(res, 'sil').outcome).toBe('cut');
    expect(finalOf(res, 'pru').outcome).toBe('bounced');
    expect(finalOf(res, 'war').outcome).toBe('succeeded');
  });

  it('diagram 16: support NOT cut by an unsuccessful attack from the target province', () => {
    const units = [A('GERMANY', 'pru'), A('GERMANY', 'sil'), A('RUSSIA', 'war')];
    const res = adjudicateMovement(units, [move('pru', 'war'), supportMove('sil', 'pru', 'war'), move('war', 'sil')]);
    expect(finalOf(res, 'sil').outcome).toBe('succeeded');
    expect(finalOf(res, 'pru').outcome).toBe('succeeded');
    expect(finalOf(res, 'war').outcome).toBe('dislodged');
  });

  it('diagram 17: support cut because the target-province attack actually dislodges', () => {
    const units = [F('GERMANY', 'ber'), A('GERMANY', 'sil'), A('RUSSIA', 'pru'), A('RUSSIA', 'war'), F('RUSSIA', 'bal')];
    const res = adjudicateMovement(units, [
      move('ber', 'pru'),
      supportMove('sil', 'ber', 'pru'),
      move('pru', 'sil'),
      supportMove('war', 'pru', 'sil'),
      move('bal', 'pru'),
    ]);
    // Russian A Pru-Sil (supported by War) dislodges German A Sil, cutting its support
    // of F Ber-Pru, so the German fleet's attack loses its support...
    expect(finalOf(res, 'sil').outcome).toBe('dislodged');
    // ...and the Russian fleet in Baltic stands off the now-unsupported German fleet.
    expect(finalOf(res, 'ber').outcome).toBe('bounced');
  });

  it('diagram 18: a dislodged unit can still cut support elsewhere', () => {
    const units = [A('GERMANY', 'ber'), A('GERMANY', 'mun'), A('RUSSIA', 'pru'), A('RUSSIA', 'sil'), A('AUSTRIA', 'boh'), A('AUSTRIA', 'tyr')];
    const res = adjudicateMovement(units, [
      hold('ber'),
      move('mun', 'sil'),
      move('pru', 'ber'),
      supportMove('sil', 'pru', 'ber'),
      move('boh', 'mun'),
      supportMove('tyr', 'boh', 'mun'),
    ]);
    expect(finalOf(res, 'mun').outcome).toBe('dislodged'); // Austria beats Germany into Munich
    expect(finalOf(res, 'sil').outcome).toBe('cut'); // but Munich's attack still cuts Silesia's support
    expect(finalOf(res, 'ber').outcome).toBe('succeeded'); // so the Russian attack on Berlin is unsupported and bounces
  });
});

describe('convoy', () => {
  it('diagram 19: single-hop convoy', () => {
    const units = [A('ENGLAND', 'lon'), F('ENGLAND', 'nth')];
    const res = adjudicateMovement(units, [move('lon', 'nwy'), convoy('nth', 'lon', 'nwy')]);
    expect(finalOf(res, 'lon').outcome).toBe('succeeded');
    expect(res.units.find((u) => u.type === 'A')!.province).toBe('nwy');
  });

  it('diagram 20: multi-hop convoy chain', () => {
    const units = [A('ENGLAND', 'lon'), F('ENGLAND', 'eng'), F('ENGLAND', 'mao'), F('FRANCE', 'wes')];
    const res = adjudicateMovement(units, [
      move('lon', 'tun'),
      convoy('eng', 'lon', 'tun'),
      convoy('mao', 'lon', 'tun'),
      convoy('wes', 'lon', 'tun'),
    ]);
    expect(finalOf(res, 'lon').outcome).toBe('succeeded');
  });

  it('diagram 21: dislodging a convoying fleet disrupts the convoy', () => {
    const units = [A('FRANCE', 'spa'), F('FRANCE', 'lyo'), F('FRANCE', 'tys'), F('ITALY', 'ion'), F('ITALY', 'tun')];
    const res = adjudicateMovement(units, [
      move('spa', 'nap'),
      convoy('lyo', 'spa', 'nap'),
      convoy('tys', 'spa', 'nap'),
      move('ion', 'tys'),
      supportMove('tun', 'ion', 'tys'),
    ]);
    expect(finalOf(res, 'tys').outcome).toBe('dislodged');
    expect(finalOf(res, 'spa').outcome).not.toBe('succeeded');
    expect(res.units.find((u) => u.type === 'A')!.province).toBe('spa');
  });

  it('diagram 29: an army with two convoy routes lands even if one is disrupted', () => {
    const units = [
      A('ENGLAND', 'lon'),
      F('ENGLAND', 'eng'),
      F('ENGLAND', 'nth'),
      F('FRANCE', 'bre'),
      F('FRANCE', 'iri'),
    ];
    const res = adjudicateMovement(units, [
      move('lon', 'bel'),
      convoy('eng', 'lon', 'bel'),
      convoy('nth', 'lon', 'bel'),
      move('bre', 'eng'),
      supportMove('iri', 'bre', 'eng'),
    ]);
    expect(finalOf(res, 'eng').outcome).toBe('dislodged');
    expect(finalOf(res, 'lon').outcome).toBe('succeeded');
    expect(res.units.find((u) => u.type === 'A')!.province).toBe('bel');
  });
});

describe('convoy paradox (rules 21/22)', () => {
  it('diagram 30: a convoyed attack does not cut support against its own necessary convoy fleet', () => {
    const units = [A('FRANCE', 'tun'), F('FRANCE', 'tys'), F('ITALY', 'ion'), F('ITALY', 'nap')];
    const res = adjudicateMovement(units, [
      move('tun', 'nap'),
      convoy('tys', 'tun', 'nap'),
      move('ion', 'tys'),
      supportMove('nap', 'ion', 'tys'),
    ]);
    // The convoy is blocked (Tyrrhenian is dislodged), so Tunis never actually moves...
    expect(finalOf(res, 'tys').outcome).toBe('dislodged');
    expect(finalOf(res, 'tun').outcome).not.toBe('succeeded');
    expect(res.units.find((u) => u.type === 'A')!.province).toBe('tun');
    // ...and per rule 21, Tunis's blocked attack never cut Naples's support in the first place.
    expect(finalOf(res, 'nap').outcome).not.toBe('cut');
  });
});

describe('full turn: rulebook Spring 1901 sample game', () => {
  it('matches the documented resolution exactly', () => {
    const units = [
      A('AUSTRIA', 'vie'),
      A('AUSTRIA', 'bud'),
      F('AUSTRIA', 'tri'),
      A('ENGLAND', 'lvp'),
      F('ENGLAND', 'lon'),
      F('ENGLAND', 'edi'),
      A('FRANCE', 'par'),
      A('FRANCE', 'mar'),
      F('FRANCE', 'bre'),
      A('GERMANY', 'ber'),
      A('GERMANY', 'mun'),
      F('GERMANY', 'kie'),
      A('ITALY', 'ven'),
      A('ITALY', 'rom'),
      F('ITALY', 'nap'),
      A('RUSSIA', 'mos'),
      A('RUSSIA', 'war'),
      F('RUSSIA', 'stp', 'sc'),
      F('RUSSIA', 'sev'),
      A('TURKEY', 'con'),
      A('TURKEY', 'smy'),
      F('TURKEY', 'ank'),
    ];
    const orders = [
      move('vie', 'tri'),
      move('bud', 'gal'),
      move('tri', 'alb'),
      move('lvp', 'yor'),
      move('lon', 'nth'),
      move('edi', 'nwg'),
      move('par', 'bur'),
      move('mar', 'spa'),
      move('bre', 'pic'),
      move('ber', 'kie'),
      move('mun', 'ruh'),
      move('kie', 'den'),
      move('ven', 'pie'),
      move('rom', 'ven'),
      move('nap', 'ion'),
      move('mos', 'ukr'),
      move('war', 'gal'),
      move('stp', 'bot'),
      move('sev', 'bla'),
      move('con', 'bul'),
      move('smy', 'con'),
      move('ank', 'bla'),
    ];
    const res = adjudicateMovement(units, orders);
    const failed = new Set(['bud', 'war', 'sev', 'ank']);
    for (const r of res.resolved) {
      if (failed.has(r.order.unit.province)) {
        expect(r.outcome, `${r.order.unit.province} should bounce`).toBe('bounced');
      } else if (r.order.kind === 'move') {
        expect(r.outcome, `${r.order.unit.province} should succeed`).toBe('succeeded');
      }
    }
    expect(res.dislodgements).toHaveLength(0);
  });
});

describe('self-dislodgement rules', () => {
  it('diagram 22: a power cannot dislodge its own unit even with its own support', () => {
    const units = [A('FRANCE', 'par'), A('FRANCE', 'mar'), A('FRANCE', 'bur')];
    const res = adjudicateMovement(units, [move('par', 'bur'), supportMove('mar', 'par', 'bur'), hold('bur')]);
    expect(finalOf(res, 'bur').outcome).toBe('succeeded');
    expect(finalOf(res, 'par').outcome).toBe('bounced');
  });

  it('diagram 24: a foreign power cannot legally support dislodging the defender\'s own unit', () => {
    const units = [A('GERMANY', 'ruh'), A('GERMANY', 'mun'), A('FRANCE', 'par'), A('FRANCE', 'bur')];
    const res = adjudicateMovement(units, [
      move('ruh', 'bur'),
      hold('mun'),
      supportMove('par', 'ruh', 'bur'),
      hold('bur'),
    ]);
    expect(finalOf(res, 'bur').outcome).toBe('succeeded'); // French support for Germany's attack on France's own unit is void
    expect(finalOf(res, 'ruh').outcome).toBe('bounced');
  });

  it('diagram 27: self standoff can succeed via foreign support without self-dislodging', () => {
    const units = [A('AUSTRIA', 'ser'), A('AUSTRIA', 'vie'), A('RUSSIA', 'gal')];
    const res = adjudicateMovement(units, [move('ser', 'bud'), move('vie', 'bud'), supportMove('gal', 'ser', 'bud')]);
    expect(finalOf(res, 'ser').outcome).toBe('succeeded');
    expect(finalOf(res, 'vie').outcome).toBe('bounced');
  });
});
