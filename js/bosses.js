export const BOSSES = [
  { id:'riptide', name:'Riptide Weaver', element:'Water / Azure Fire', desc:'Aqua leviathan. 3 phases, 60+ attacks.', baseHp:1200, color:0x2a8aff, accent:0x00e5ff },
  { id:'inferno', name:'Inferno Colossus', element:'Fire', desc:'Molten giant. Erupting flame patterns.', baseHp:1400, color:0xff5500, accent:0xffaa00 },
  { id:'frost', name:'Frost Empress', element:'Ice', desc:'Glacial queen. Freezing shards.', baseHp:1100, color:0x88ddff, accent:0xffffff },
  { id:'storm', name:'Storm Sovereign', element:'Lightning', desc:'Thunder lord. Chain lightning.', baseHp:1300, color:0xaa88ff, accent:0xffff44 },
  { id:'void', name:'Void Tyrant', element:'Dark', desc:'Abyssal ruler. Gravity wells.', baseHp:1600, color:0x6600aa, accent:0xff00ff }
];

export const DIFFICULTIES = [
  {id:'veryeasy', name:'Very Easy', mult:0.5, speed:0.7, count:0.7},
  {id:'easy', name:'Easy', mult:0.7, speed:0.8, count:0.8},
  {id:'medium', name:'Medium', mult:0.85, speed:0.9, count:0.9},
  {id:'mediocre', name:'Mediocre', mult:1.0, speed:1.0, count:1.0},
  {id:'hard', name:'Hard', mult:1.2, speed:1.1, count:1.1},
  {id:'veryhard', name:'Very Hard', mult:1.4, speed:1.2, count:1.25},
  {id:'insane', name:'Insane', mult:1.7, speed:1.35, count:1.4},
  {id:'expert', name:'Expert', mult:2.0, speed:1.5, count:1.6},
  {id:'hell', name:'Hell', mult:2.5, speed:1.7, count:1.8},
  {id:'godly', name:'Godly', mult:3.0, speed:2.0, count:2.0}
];

export function getBoss(id){ return BOSSES.find(b=>b.id===id); }
export function getDiff(id){ return DIFFICULTIES.find(d=>d.id===id); }
