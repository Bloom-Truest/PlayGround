export class AudioSys {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { this.enabled=false; }
    }
  }
  play(name) {
    this.ensure();
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    const presets = {
      swing: { f:220, type:'sawtooth', dur:0.12, vol:0.15 },
      hit: { f:120, type:'square', dur:0.15, vol:0.2 },
      parry: { f:660, type:'triangle', dur:0.2, vol:0.2 },
      stagger: { f:80, type:'sawtooth', dur:0.3, vol:0.25 },
      dodge: { f:300, type:'sine', dur:0.1, vol:0.12 },
      cast: { f:440, type:'sine', dur:0.25, vol:0.15 },
      death: { f:60, type:'sawtooth', dur:0.8, vol:0.3 },
      level: { f:880, type:'triangle', dur:0.3, vol:0.2 },
      enemy: { f:180, type:'square', dur:0.1, vol:0.15 },
    };
    const p = presets[name] || presets.hit;
    o.type = p.type;
    o.frequency.setValueAtTime(p.f, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, p.f*0.5), now+p.dur);
    g.gain.setValueAtTime(p.vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now+p.dur);
    o.start(now); o.stop(now+p.dur);
  }
}
