export const TEAMS = [
  { id:'crimson', name:'Crimson Wolves', color:'#c0392b', accent:'#f1c40f' },
  { id:'azure',   name:'Azure Falcons',  color:'#2980b9', accent:'#ecf0f1' },
  { id:'emerald', name:'Emerald Dragons',color:'#27ae60', accent:'#f39c12' },
  { id:'golden',  name:'Golden Lions',   color:'#d4ac0d', accent:'#1a1a1a' },
];

const FIRST = ['Kenji','Ren','Yuto','Daichi','Shoyo','Tobio','Kei','Ryunosuke','Yu','Asahi','Kotaro','Atsumu','Osamu','Kiyoomi','Motoya','Wakatoshi','Tendo','Eita','Goshiki','Tsutomu','Kourai','Kenma','Lev','Tetsuro','Morisuke','Takahiro','Shinsuke','Hayato','Kazuma','Riku','Haruki','Sora','Kaito','Yuma','Naoki','Takumi','Shun','Kenta','Masato','Daiki','Ryota','Sho','Tatsuki','Hiroshi'];
const LAST  = ['Tanaka','Yamamoto','Hinata','Kageyama','Tsukishima','Nishinoya','Azumane','Bokuto','Akaashi','Miya','Sakusa','Washio','Ushijima','Tendou','Semii','Goshiki','Kuroo','Haiba','Yaku','Fukunaga','Kozume','Hirugami','Kiryu','Komori','Iizuna','Meian','Sakado','Hoshiumi','Hirakawa','Nicoll','Oliver','Smith','Garcia','Silva','Rossi','Mueller','Dubois','Kim','Park','Lee','Chen','Wang','Sato','Ito'];
const POSITIONS = ['Setter','Outside Hitter','Middle Blocker','Opposite','Libero'];
const SPECIALTIES = ['Power Spike','Quick Attack','Jump Serve','Block Wall','Dig Master','All-Rounder','Clutch Server','Aerial Ace','Iron Defense','Phantom Feint'];

function rnd(a,b){return Math.round(a+Math.random()*(b-a));}

export const CHARACTERS = [];
let idx = 0;
for (let t=0;t<TEAMS.length;t++){
  const team = TEAMS[t];
  for (let i=0;i<11;i++){
    const pos = POSITIONS[i % POSITIONS.length];
    const power = rnd(60,99);
    const speed = rnd(60,99);
    const jump  = rnd(60,99);
    const stamina= rnd(60,99);
    const height = 175 + rnd(0,25);
    const fn = FIRST[idx % FIRST.length];
    const ln = LAST[(idx*7+3) % LAST.length];
    CHARACTERS.push({
      id: `p${idx}`,
      name: `${fn} ${ln}`,
      team: team.id,
      teamName: team.name,
      number: (i+1)+(t*11),
      position: pos,
      height, power, speed, jump, stamina,
      specialty: SPECIALTIES[idx % SPECIALTIES.length],
      color: team.color,
      accent: team.accent,
      skin: ['#f5cba7','#e0ac69','#c68642','#8d5524','#f1c27d'][idx%5],
      hair: ['#1a1a1a','#3b2f2f','#6b4423','#b5651d','#d4a017'][idx%5],
      ability: SPECIALTIES[idx % SPECIALTIES.length],
    });
    idx++;
  }
}
export function byId(id){ return CHARACTERS.find(c=>c.id===id); }
export function byTeam(teamId){ return CHARACTERS.filter(c=>c.team===teamId); }
