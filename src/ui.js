export class UI {
  constructor(player, enemies) {
    this.player = player;
    this.enemies = enemies;
    this.toastTimer = 0;
    this.toastEl = document.getElementById('toast');
  }
  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._t);
    this._t = setTimeout(() => this.toastEl.classList.remove('show'), 1800);
  }
  update() {
    const p = this.player;
    const setBar = (sel, ratio) => {
      const el = document.querySelector(sel + ' .fill');
      if (el) el.style.width = (Math.max(0,Math.min(1,ratio))*100) + '%';
    };
    setBar('.hp', p.hp / p.maxHp);
    setBar('.st', p.stamina / p.maxStamina);
    setBar('.mp', p.mana / p.maxMana);
    setBar('.po', p.posture / p.maxPosture);
    document.getElementById('level').textContent = 'Lv ' + (window.game?window.game.player?1:1:1);
    // level from main? We'll store on player
    const raceName = p.race === 'quincy' ? 'Quincy' : p.race === 'hollow' ? 'Hollow' : 'Soul Reaper';
    document.getElementById('race').textContent = 'Race: ' + raceName;
    const lvl = p._level || 1;
    const grades = ['6th','5th','4th','3rd','2nd','1st','Special'];
    const gi = Math.min(grades.length-1, Math.floor((lvl-1)/5));
    document.getElementById('grade').textContent = 'Grade: ' + grades[gi];
    document.getElementById('level').textContent = 'Lv ' + lvl;
    document.getElementById('xp').textContent = 'XP ' + (p._xp||0) + '/' + (p._xpNeed||100);
    document.getElementById('wave').textContent = 'Wave ' + (window._wave||1);
    document.getElementById('spell').textContent = 'Spell: ' + ['Fireball','Frost Nova','Heal'][p.currentSpell];
    const sigName = p.race === 'quincy' ? 'Blut Vene' : p.race === 'hollow' ? 'Cero' : 'Shikai';
    document.getElementById('sig').textContent = 'Sig: ' + sigName + ' (C)';
    document.getElementById('tp').textContent = window._talentPoints || 0;
    document.querySelectorAll('.slot').forEach((s,idx) => s.classList.toggle('active', idx === (this.player.selectedSlot||0)));
  }
}
