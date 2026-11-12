// Original (non-licensed) soccer game data - designs inspired by attached player cards
const TEAMS = [
  {
    id:'origin', name:'Origin FC', color:'#1e6bd6', accent:'#ffd700', gkColor:'#f0e68c',
    formation:'4-3-3', special:'Team Massacrer',
    players:[
      {n:1,name:'Myra',pos:'GK',num:1,speed:6,shot:2,pass:5,def:9,spirit:120,special:'SteelHands',ovr:96,card:'cards/myra.png'},
      {n:2,name:'Rook',pos:'DF',num:2,speed:5,shot:3,pass:4,def:7,spirit:100,special:null,ovr:82,card:null},
      {n:3,name:'Bram',pos:'DF',num:3,speed:5,shot:3,pass:4,def:7,spirit:100,special:null,ovr:82,card:null},
      {n:4,name:'Ivo',pos:'MF',num:4,speed:6,shot:5,pass:7,def:5,spirit:100,special:null,ovr:84,card:null},
      {n:5,name:'Nex',pos:'FW',num:5,speed:7,shot:7,pass:5,def:3,spirit:100,special:null,ovr:85,card:null},
      {n:6,name:'Tal',pos:'FW',num:6,speed:7,shot:6,pass:5,def:3,spirit:100,special:null,ovr:84,card:null},
      {n:7,name:'Dax',pos:'DF',num:7,speed:5,shot:3,pass:4,def:7,spirit:100,special:null,ovr:83,card:null},
      {n:8,name:'Pax',pos:'MF',num:8,speed:6,shot:5,pass:6,def:5,spirit:100,special:null,ovr:84,card:null},
      {n:9,name:'Zed',pos:'MF',num:9,speed:6,shot:6,pass:6,def:5,spirit:100,special:null,ovr:85,card:null},
      {n:10,name:'Lemio Ayoshi',pos:'FW',num:10,speed:9,shot:9,pass:6,def:5,spirit:120,special:'Thronesitter',ovr:99,card:'cards/lemio_ayoshi.png'},
      {n:11,name:'Kael',pos:'FW',num:11,speed:9,shot:8,pass:6,def:3,spirit:100,special:'QuickStep',ovr:94,card:'cards/kael.png'}
    ]
  },
  {
    id:'hermes', name:'Hermes Academy', color:'#8e44ad', accent:'#fff', gkColor:'#ddd',
    formation:'4-2-3-1', special:'Divinity',
    players:[
      {n:1,name:'GK',pos:'GK',num:1,speed:5,shot:2,pass:4,def:8,spirit:100,special:null,ovr:85,card:null},
      {n:2,name:'DF1',pos:'DF',num:2,speed:5,shot:3,pass:4,def:7,spirit:100,special:null,ovr:83,card:null},
      {n:3,name:'DF2',pos:'DF',num:3,speed:5,shot:3,pass:4,def:7,spirit:100,special:null,ovr:83,card:null},
      {n:4,name:'DF3',pos:'DF',num:4,speed:4,shot:3,pass:4,def:8,spirit:100,special:null,ovr:84,card:null},
      {n:5,name:'DF4',pos:'DF',num:5,speed:4,shot:3,pass:4,def:8,spirit:100,special:null,ovr:84,card:null},
      {n:6,name:'MF1',pos:'MF',num:6,speed:6,shot:5,pass:7,def:5,spirit:100,special:null,ovr:85,card:null},
      {n:7,name:'MF2',pos:'MF',num:7,speed:6,shot:5,pass:7,def:5,spirit:100,special:null,ovr:85,card:null},
      {n:8,name:'MF3',pos:'MF',num:8,speed:6,shot:6,pass:6,def:4,spirit:100,special:null,ovr:85,card:null},
      {n:9,name:'FW1',pos:'FW',num:9,speed:7,shot:7,pass:5,def:3,spirit:100,special:null,ovr:86,card:null},
      {n:10,name:'Hermes',pos:'MF',num:10,speed:8,shot:7,pass:10,def:6,spirit:120,special:'Supercomputer',ovr:99,dri:10,card:'cards/hermes.png'},
      {n:11,name:'FW2',pos:'FW',num:11,speed:7,shot:7,pass:5,def:3,spirit:100,special:null,ovr:86,card:null}
    ]
  },
  {
    id:'titan', name:'Titan United', color:'#c0392b', accent:'#111', gkColor:'#222',
    formation:'4-4-2', special:'Iron Defense',
    players:[
      {n:1,name:'GK',pos:'GK',num:1,speed:5,shot:2,pass:4,def:8,spirit:100,special:null,ovr:85,card:null},
      {n:2,name:'DF',pos:'DF',num:2,speed:5,shot:3,pass:4,def:7,spirit:100,special:null,ovr:83,card:null},
      {n:3,name:'DF',pos:'DF',num:3,speed:5,shot:3,pass:4,def:7,spirit:100,special:null,ovr:83,card:null},
      {n:4,name:'Vorn',pos:'DF',num:4,speed:5,shot:3,pass:5,def:9,spirit:120,special:'IronGuard',ovr:95,card:'cards/vorn.png'},
      {n:5,name:'DF',pos:'DF',num:5,speed:4,shot:3,pass:4,def:8,spirit:100,special:null,ovr:84,card:null},
      {n:6,name:'MF',pos:'MF',num:6,speed:6,shot:5,pass:6,def:5,spirit:100,special:null,ovr:84,card:null},
      {n:7,name:'MF',pos:'MF',num:7,speed:6,shot:5,pass:7,def:5,spirit:100,special:null,ovr:85,card:null},
      {n:8,name:'MF',pos:'MF',num:8,speed:6,shot:6,pass:6,def:4,spirit:100,special:null,ovr:85,card:null},
      {n:9,name:'FW',pos:'FW',num:9,speed:7,shot:8,pass:5,def:3,spirit:100,special:null,ovr:86,card:null},
      {n:10,name:'FW',pos:'FW',num:10,speed:7,shot:8,pass:5,def:3,spirit:100,special:null,ovr:86,card:null},
      {n:11,name:'FW',pos:'FW',num:11,speed:6,shot:7,pass:5,def:3,spirit:100,special:null,ovr:85,card:null}
    ]
  },
  {
    id:'eclipse', name:'Eclipse SC', color:'#27ae60', accent:'#fff', gkColor:'#eee',
    formation:'4-3-3', special:'Swift Play',
    players:[
      {n:1,name:'GK',pos:'GK',num:1,speed:4,shot:2,pass:4,def:7,spirit:100,special:null,ovr:83,card:null},
      {n:2,name:'DF',pos:'DF',num:2,speed:5,shot:3,pass:4,def:7,spirit:100,special:null,ovr:82,card:null},
      {n:3,name:'DF',pos:'DF',num:3,speed:5,shot:3,pass:4,def:7,spirit:100,special:null,ovr:82,card:null},
      {n:4,name:'DF',pos:'DF',num:4,speed:4,shot:3,pass:4,def:8,spirit:100,special:null,ovr:83,card:null},
      {n:5,name:'DF',pos:'DF',num:5,speed:4,shot:3,pass:4,def:8,spirit:100,special:null,ovr:83,card:null},
      {n:6,name:'MF',pos:'MF',num:6,speed:6,shot:5,pass:7,def:5,spirit:100,special:null,ovr:84,card:null},
      {n:7,name:'MF',pos:'MF',num:7,speed:6,shot:5,pass:7,def:5,spirit:100,special:null,ovr:84,card:null},
      {n:8,name:'MF',pos:'MF',num:8,speed:6,shot:6,pass:6,def:4,spirit:100,special:null,ovr:84,card:null},
      {n:9,name:'FW',pos:'FW',num:9,speed:7,shot:7,pass:5,def:3,spirit:100,special:null,ovr:85,card:null},
      {n:10,name:'FW',pos:'FW',num:10,speed:7,shot:7,pass:5,def:3,spirit:100,special:null,ovr:85,card:null},
      {n:11,name:'FW',pos:'FW',num:11,speed:7,shot:7,pass:5,def:3,spirit:100,special:null,ovr:85,card:null}
    ]
  }
];

const STADIUMS = [
  {id:'origin_arena', name:'Origin Arena', sky:'#87ceeb', crowd:'#4a2a1a'},
  {id:'hermes_dome', name:'Hermes Dome', sky:'#a0d8ef', crowd:'#2a4a1a'},
  {id:'titan_park', name:'Titan Park', sky:'#b0e0e6', crowd:'#3a3a2a'}
];

const STORY = [
  {title:'Episode Origin', text:'A new legend begins. Origin FC rises to challenge the best.'},
];