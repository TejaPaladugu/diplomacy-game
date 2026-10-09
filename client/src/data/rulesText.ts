export interface RuleSection {
  heading: string;
  body: string[];
}

export const RULE_SECTIONS: RuleSection[] = [
  {
    heading: 'Overview',
    body: [
      'Diplomacy is a game of negotiation, alliances, and broken promises for 2-7 players (standard: 7), each controlling a Great Power in pre-WWI Europe.',
      'Each turn represents six months: a Spring turn then a Fall turn, starting Spring 1901.',
      'All units have equal strength. There is only ever one unit per province. Units gain strength only through support from other units.',
      'A player controlling 18 or more supply centers wins. Players may also agree to end the game in a draw.',
    ],
  },
  {
    heading: 'Turn phases',
    body: [
      'Spring: Orders -> Order Resolution -> Retreat & Disbanding (if needed).',
      'Fall: Orders -> Order Resolution -> Retreat & Disbanding (if needed) -> Gaining & Losing Units (builds/disbands).',
      'A country controls a supply center when one of its units occupies it after a Fall turn (including retreats) is complete. Spring occupation alone does not change ownership.',
    ],
  },
  {
    heading: 'Orders',
    body: [
      'Hold: the unit stays in place. A unit with no order, or an illegal/ambiguous order, is treated as holding.',
      'Move: an Army can move to an adjacent inland or coastal province. A Fleet can move to an adjacent coastal or water province, moving along the coastline between coastal provinces.',
      'Support: a unit gives up its own move to add +1 strength to another unit\'s hold or move. The supporting unit must be able to legally reach the province it is supporting into. A unit ordered to move can only be supported by a support order matching that exact move; a unit not ordered to move can be supported by a support order that only names its province.',
      'Convoy: only Fleets in open sea provinces (not coastal provinces, including Kiel/Denmark/Constantinople) can convoy. A Fleet convoys one Army per turn across one or more connected sea provinces to a coastal destination.',
    ],
  },
  {
    heading: 'Standoffs & dislodgement',
    body: [
      'Units of equal strength contesting the same province all bounce back to their original provinces; none of them moves.',
      'A standoff does not dislodge a unit already sitting in that province.',
      'One unit not moving (holding, supporting, or convoying) can block a whole chain of units from moving through it.',
      'Units cannot trade places directly without a convoy. Three or more units can rotate through a cycle of provinces in one turn as long as no two of them are directly trading places.',
      'A country can never dislodge, or support the dislodgement of, one of its own units - even if that would otherwise happen.',
    ],
  },
  {
    heading: 'Cutting support',
    body: [
      "Support is cut if the supporting unit is attacked from any province except the one the support is aimed at. It's cut whether or not that attack actually succeeds.",
      'If the attack comes from the exact province the support is aimed at, the support is only cut if that attack actually dislodges the supporting unit.',
      'A dislodged unit still cuts support anywhere it was ordered to attack, even though it never gets there.',
      'An attack by a country on one of its own units never cuts support.',
      'A convoyed Army never cuts the support of a unit defending one of the Fleets that convoy depends on - unless that Army has another working convoy route that avoids that Fleet.',
    ],
  },
  {
    heading: 'Convoys',
    body: [
      'An Army being convoyed must be ordered to move to its destination, and every Fleet in the chain must be ordered to convoy that exact Army to that exact destination.',
      'If a convoying Fleet is dislodged, the convoy fails and the Army stays home (unless an alternate, undisrupted route still exists).',
      'If a convoyed Army would only bounce at its destination, it simply stays in its original province rather than being destroyed.',
      'Two units can swap provinces only if at least one of them is convoyed.',
    ],
  },
  {
    heading: 'Retreats',
    body: [
      'A dislodged unit must retreat to an adjacent province it could normally reach, that is not occupied, was not vacated by a standoff this same turn, and is not the attacker\'s own province.',
      'If no legal retreat exists, or the player chooses not to retreat, the unit is disbanded.',
      'If two or more dislodged units are ordered to retreat to the same province, all of them are disbanded instead.',
      'Retreats cannot be supported or convoyed.',
    ],
  },
  {
    heading: 'Builds & disbands',
    body: [
      'After each Fall turn, compare supply centers controlled to units on the board. Extra centers allow builds (in unoccupied, controlled home centers only); a shortfall requires disbanding that many units, the owner\'s choice of which.',
      'Only an Army can be built on an inland home center. A coastal home center build must specify Army or Fleet; for St Petersburg you must also pick North or South Coast.',
      'A country with no home centers left can still fight on with whatever units remain, and can build again once it recaptures a home center.',
    ],
  },
  {
    heading: 'The 22 rules (quick reference)',
    body: [
      '1. All units have the same strength.',
      '2. There can only be one unit in a province at a time.',
      '3. Equal strength units trying to occupy the same province all remain in their original provinces.',
      '4. A standoff does not dislodge a unit already in the province where the standoff took place.',
      '5. One unit not moving can stop a series of other units from moving.',
      '6. Units cannot trade places without the use of a convoy.',
      '7. Three or more units can rotate provinces in a turn provided none directly trade places.',
      '8. A unit not ordered to move can be supported by a support order that only mentions its province.',
      '9. A unit ordered to move can only be supported by a support order that matches the move it is trying to make.',
      '10. A dislodged unit can still cause a standoff in a province other than the one that dislodged it.',
      '11. A dislodged unit, even with support, has no effect on the province that dislodged it.',
      '12. A country cannot dislodge or support the dislodgment of one of its own units, even if unexpected.',
      '13. Support is cut if the unit giving support is attacked from any province except the one support is being given to.',
      '14. Support is cut if the supporting unit is dislodged.',
      '15. A unit being dislodged by one province can still cut support in another.',
      '16. An attack by a country on one of its own units does not cut support.',
      '17. Dislodgment of a Fleet necessary to a convoy causes that convoy to fail.',
      '18. A convoy that would cause the convoyed Army to standoff at its destination leaves that Army in its original province.',
      '19. Two units can exchange places if either or both are convoyed. (Exception to Rule 6.)',
      '20. An Army convoyed using alternate convoy orders reaches its destination as long as at least one convoy route remains open.',
      '21. A convoyed Army does not cut the support of a unit supporting an attack against one of the Fleets necessary for the Army to convoy. (Supersedes Rule 13.)',
      '22. An Army with at least one successful convoy route will cut the support given by a unit in the destination province that is supporting an attack on a Fleet in an alternate route of that convoy. (Supersedes Rule 21.)',
    ],
  },
];
