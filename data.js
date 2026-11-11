// Captain Tsubasa: Rise of New Champions - inspired data
const TEAMS = [
  {
    id:'nankatsu', name:'Nankatsu MS', color:'#1e6bd6', accent:'#ffd700', gkColor:'#f0e68c',
    formation:'4-3-3', special:'Drive Shot',
    players:[
      {n:1,name:'Morisaki',pos:'GK',num:1,speed:4,shot:2,pass:4,def:5,spirit:100,special:null},
      {n:2,name:'Ishizaki',pos:'DF',num:2,speed:5,shot:3,pass:4,def:6,spirit:100,special:null},
      {n:3,name:'Takasugi',pos:'DF',num:3,speed:4,shot:3,pass:4,def:7,spirit:100,special:null},
      {n:4,name:'Izawa',pos:'MF',num:4,speed:5,shot:5,pass:7,def:5,spirit:100,special:'Heading'},
      {n:5,name:'Kisugi',pos:'FW',num:5,speed:6,shot:7,pass:5,def:3,spirit:100,special:null},
      {n:6,name:'Taki',pos:'FW',num:6,speed:6,shot:6,pass:5,def:3,spirit:100,special:'Sideline'},
      {n:7,name:'Nakayama',pos:'DF',num:7,speed:4,shot:3,pass:4,def:6,spirit:100,special:null},
      {n:8,name:'Kishida',pos:'MF',num:8,speed:5,shot:4,pass:6,def:5,spirit:100,special:null},
      {n:9,name:'Urabe',pos:'MF',num:9,speed:5,shot:5,pass:6,def:5,spirit:100,special:null},
      {n:10,name:'Tsubasa',pos:'MF',num:10,speed:7,shot:9,pass:9,def:6,spirit:120,special:'Drive Shot'},
      {n:11,name:'Nitta',pos:'FW',num:11,speed:7,shot:7,pass:5,def:3,spirit:100,special:null}
    ]
  },
  {
    id:'toho', name:'Toho Academy', color:'#c0392b', accent:'#111', gkColor:'#222',
    formation:'4-4-2', special:'Tiger Shot',
    players:[
      {n:1,name:'Wakashimazu',pos:'GK',num:1,speed:5,shot:2,pass:4,def:8,spirit:120,special:'Karate Save'},
      {n:2,name:'Sawada',pos:'DF',num:2,speed:5,shot:4,pass:5,def:6,spirit:100,special:null},
      {n:3,name:'Ishida',pos:'DF',num:3,speed:4,shot:3,pass:4,def:7,spirit:100,special:null},
      {n:4,name:'Oda',pos:'DF',num:4,speed:4,shot:3,pass:4,def:7,spirit:100,special:null},
      {n:5,name:'Soda',pos:'MF',num:5,speed:6,shot:6,pass:6,def:5,spirit:100,special:null},
      {n:6,name:'Takeshi',pos:'MF',num:6,speed:5,shot:5,pass:6,def:5,spirit:100,special:null},
      {n:7,name:'Matsuki',pos:'MF',num:7,speed:5,shot:5,pass:7,def:5,spirit:100,special:null},
      {n:8,name:'Kazami',pos:'MF',num:8,speed:6,shot:6,pass:6,def:4,spirit:100,special:null},
      {n:9,name:'Hyuga',pos:'FW',num:9,speed:7,shot:10,pass:5,def:4,spirit:120,special:'Tiger Shot'},
      {n:10,name:'Aoi',pos:'FW',num:10,speed:7,shot:8,pass:5,def:3,spirit:100,special:null},
      {n:11,name:'Sano',pos:'FW',num:11,speed:6,shot:7,pass:5,def:3,spirit:100,special:null}
    ]
  },
  {
    id:'musashi', name:'Musashi MS', color:'#8e44ad', accent:'#fff', gkColor:'#ddd',
    formation:'4-2-3-1', special:'Elegant Play',
    players:[
      {n:1,name:'GK Misugi',pos:'GK',num:1,speed:4,shot:2,pass:4,def:6,spirit:100,special:null},
      {n:2,name:'DF1',pos:'DF',num:2,speed:5,shot:3,pass:4,def:6,spirit:100,special:null},
      {n:3,name:'DF2',pos:'DF',num:3,speed:5,shot:3,pass:4,def:6,spirit:100,special:null},
      {n:4,name:'DF3',pos:'DF',num:4,speed:4,shot:3,pass:4,def:7,spirit:100,special:null},
      {n:5,name:'DF4',pos:'DF',num:5,speed:4,shot:3,pass:4,def:7,spirit:100,special:null},
      {n:6,name:'MF1',pos:'MF',num:6,speed:6,shot:5,pass:7,def:5,spirit:100,special:null},
      {n:7,name:'MF2',pos:'MF',num:7,speed:6,shot:5,pass:7,def:5,spirit:100,special:null},
      {n:8,name:'MF3',pos:'MF',num:8,speed:6,shot:6,pass:6,def:4,spirit:100,special:null},
      {n:9,name:'FW1',pos:'FW',num:9,speed:7,shot:7,pass:5,def:3,spirit:100,special:null},
      {n:10,name:'Misugi',pos:'MF',num:10,speed:8,shot:8,pass:9,def:6,spirit:120,special:'Young Noble'},
      {n:11,name:'FW2',pos:'FW',num:11,speed:7,shot:7,pass:5,def:3,spirit:100,special:null}
    ]
  },
  {
    id:'furano', name:'Furano MS', color:'#27ae60', accent:'#fff', gkColor:'#eee',
    formation:'4-4-2', special:'Eagle Shot',
    players:[
      {n:1,name:'GK',pos:'GK',num:1,speed:4,shot:2,pass:4,def:6,spirit:100,special:null},
      {n:2,name:'DF',pos:'DF',num:2,speed:5,shot:3,pass:4,def:6,spirit:100,special:null},
      {n:3,name:'DF',pos:'DF',num:3,speed:5,shot:3,pass:4,def:6,spirit:100,special:null},
      {n:4,name:'DF',pos:'DF',num:4,speed:4,shot:3,pass:4,def:7,spirit:100,special:null},
      {n:5,name:'DF',pos:'DF',num:5,speed:4,shot:3,pass:4,def:7,spirit:100,special:null},
      {n:6,name:'MF',pos:'MF',num:6,speed:6,shot:5,pass:7,def:5,spirit:100,special:null},
      {n:7,name:'MF',pos:'MF',num:7,speed:6,shot:5,pass:7,def:5,spirit:100,special:null},
      {n:8,name:'MF',pos:'MF',num:8,speed:6,shot:6,pass:6,def:4,spirit:100,special:null},
      {n:9,name:'FW',pos:'FW',num:9,speed:7,shot:7,pass:5,def:3,spirit:100,special:null},
      {n:10,name:'Matsuyama',pos:'MF',num:10,speed:7,shot:8,pass:8,def:6,spirit:120,special:'Eagle Shot'},
      {n:11,name:'FW',pos:'FW',num:11,speed:7,shot:7,pass:5,def:3,spirit:100,special:null}
    ]
  },
  {
    id:'otomo', name:'Otomo MS', color:'#e67e22', accent:'#111', gkColor:'#ddd',
    formation:'4-3-3', special:'Otomo Quartet',
    players:[
      {n:1,name:'GK',pos:'GK',num:1,speed:4,shot:2,pass:4,def:6,spirit:100,special:null},
      {n:2,name:'Nakayama',pos:'DF',num:2,speed:5,shot:3,pass:4,def:6,spirit:100,special:null},
      {n:3,name:'Nishio',pos:'DF',num:3,speed:5,shot:3,pass:4,def:6,spirit:100,special:null},
      {n:4,name:'DF',pos:'DF',num:4,speed:4,shot:3,pass:4,def:7,spirit:100,special:null},
      {n:5,name:'DF',pos:'DF',num:5,speed:4,shot:3,pass:4,def:7,spirit:100,special:null},
      {n:6,name:'Kishida',pos:'MF',num:6,speed:6,shot:5,pass:6,def:5,spirit:100,special:null},
      {n:7,name:'MF',pos:'MF',num:7,speed:6,shot:5,pass:6,def:5,spirit:100,special:null},
      {n:8,name:'MF',pos:'MF',num:8,speed:6,shot:6,pass:6,def:4,spirit:100,special:null},
      {n:9,name:'FW',pos:'FW',num:9,speed:7,shot:7,pass:5,def:3,spirit:100,special:null},
      {n:10,name:'Urabe',pos:'MF',num:10,speed:7,shot:7,pass:7,def:5,spirit:120,special:'Quartet'},
      {n:11,name:'FW',pos:'FW',num:11,speed:7,shot:7,pass:5,def:3,spirit:100,special:null}
    ]
  },
  {
    id:'hanawa', name:'Hanawa MS', color:'#16a085', accent:'#fff', gkColor:'#ddd',
    formation:'4-3-3', special:'Skylab Hurricane',
    players:[
      {n:1,name:'GK',pos:'GK',num:1,speed:4,shot:2,pass:4,def:6,spirit:100,special:null},
      {n:2,name:'DF',pos:'DF',num:2,speed:5,shot:3,pass:4,def:6,spirit:100,special:null},
      {n:3,name:'DF',pos:'DF',num:3,speed:5,shot:3,pass:4,def:6,spirit:100,special:null},
      {n:4,name:'DF',pos:'DF',num:4,speed:4,shot:3,pass:4,def:7,spirit:100,special:null},
      {n:5,name:'DF',pos:'DF',num:5,speed:4,shot:3,pass:4,def:7,spirit:100,special:null},
      {n:6,name:'MF',pos:'MF',num:6,speed:6,shot:5,pass:6,def:5,spirit:100,special:null},
      {n:7,name:'MF',pos:'MF',num:7,speed:6,shot:5,pass:6,def:5,spirit:100,special:null},
      {n:8,name:'MF',pos:'MF',num:8,speed:6,shot:6,pass:6,def:4,spirit:100,special:null},
      {n:9,name:'Tachibana A',pos:'FW',num:9,speed:7,shot:8,pass:6,def:3,spirit:100,special:'Skylab'},
      {n:10,name:'Tachibana B',pos:'FW',num:10,speed:7,shot:8,pass:6,def:3,spirit:100,special:'Skylab'},
      {n:11,name:'FW',pos:'FW',num:11,speed:7,shot:7,pass:5,def:3,spirit:100,special:null}
    ]
  }
];

const STADIUMS = [
  {id:'national', name:'National Stadium', sky:'#87ceeb', crowd:'#4a2a1a'},
  {id:'shizuoka', name:'Shizuoka Stadium', sky:'#a0d8ef', crowd:'#2a4a1a'},
  {id:'school', name:'School Ground', sky:'#b0e0e6', crowd:'#3a3a2a'}
];

const STORY = [
  {title:'Episode Tsubasa', text:'Tsubasa Oozora aims for a three-peat at the 16th National Middle School Tournament. Nankatsu MS must first overcome the Otomo Quartet in the Shizuoka Prefecture Finals.'},
  {title:'Match 1', text:'Nankatsu vs Otomo MS - Shizuoka Prefecture Finals.'},
  {title:'Match 2', text:'Nankatsu vs Musashi MS - National Tournament.'},
  {title:'Final', text:'Nankatsu vs Toho Academy - The Championship.'}
];