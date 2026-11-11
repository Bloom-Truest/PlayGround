export const CLASSES = [
  {
    id:'vanguard', name:'Vanguard', desc:'Tanky frontline. High HP, shield ability.',
    hp:220, speed:4.2, damage:1.1, fireRate:0.18, color:0x4a9eff,
    ability:'shield', abilityCd:8
  },
  {
    id:'striker', name:'Striker', desc:'Fast glass cannon. Dash ability.',
    hp:100, speed:7.5, damage:2.0, fireRate:0.12, color:0xff6a4a,
    ability:'dash', abilityCd:4
  },
  {
    id:'mystic', name:'Mystic', desc:'Magic caster. Homing shots, heal ability.',
    hp:120, speed:5.0, damage:1.0, fireRate:0.15, color:0xb04aff,
    ability:'heal', abilityCd:12, homing:true
  },
  {
    id:'engineer', name:'Engineer', desc:'Deploys turrets. Balanced stats.',
    hp:150, speed:4.6, damage:1.2, fireRate:0.16, color:0x4aff9e,
    ability:'turret', abilityCd:10
  },
  {
    id:'phantom', name:'Phantom', desc:'Stealthy. Phase through bullets briefly.',
    hp:85, speed:8.2, damage:1.6, fireRate:0.13, color:0xaaaaaa,
    ability:'phase', abilityCd:6
  }
];

export function getClass(id){ return CLASSES.find(c=>c.id===id); }
