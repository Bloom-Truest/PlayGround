export const CLASSES = [
  {
    id:'hero', name:'Hero', desc:'Skill-based warrior. Balanced, crits, dash.',
    hp:500000, speed:6.5, damage:120000, fireRate:0.14, color:0x4af0ff,
    ability:'dash', abilityCd:3, crit:0.18, critMult:2.6
  }
];

export function getClass(id){ return CLASSES.find(c=>c.id===id) || CLASSES[0]; }
export const CLASS_LIST = CLASSES;
