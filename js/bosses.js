export const BOSSES = [
  { id:'riptide', name:'Riptide Weaver', element:'Water / Azure Fire', desc:'Aqua leviathan. Skill-based boss fight.', baseHp:12000000, color:0x2a8aff, accent:0x00e5ff }
];

export const DIFFICULTIES = [
  {id:'veryeasy', name:'Very Easy', mult:0.6, speed:0.75, count:0.7},
  {id:'easy', name:'Easy', mult:0.75, speed:0.85, count:0.8},
  {id:'medium', name:'Medium', mult:0.9, speed:0.95, count:0.9},
  {id:'mediocre', name:'Mediocre', mult:1.0, speed:1.0, count:1.0},
  {id:'hard', name:'Hard', mult:1.15, speed:1.1, count:1.1},
  {id:'veryhard', name:'Very Hard', mult:1.3, speed:1.2, count:1.2},
  {id:'insane', name:'Insane', mult:1.5, speed:1.35, count:1.35},
  {id:'expert', name:'Expert', mult:1.75, speed:1.5, count:1.5},
  {id:'hell', name:'Hell', mult:2.0, speed:1.7, count:1.7},
  {id:'godly', name:'Godly', mult:2.4, speed:2.0, count:2.0}
];

export function getBoss(id){ return BOSSES.find(b=>b.id===id) || BOSSES[0]; }
export function getDiff(id){ return DIFFICULTIES.find(d=>d.id===id); }
