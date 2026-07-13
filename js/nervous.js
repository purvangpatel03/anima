// The nervous system — one broadcast scalar that every moving thing reads,
// so the whole page provably shares a single physiology.
export class Nervous {
  constructor(root, isReduced) {
    this.root = root;            // #organism
    this.isReduced = isReduced;  // () => boolean
    this.agitation = 0;
    this.impulseEnergy = 0;
    this.breathPhase = 0;
    this.breath = 0.5;
    this.breathFreq = 0.2;       // 12 breaths/min at rest
    this.riseTau = 0.18;         // startle is fast
    this.decayTau = 0.9;         // calm is slow
    this.drowse = 0;             // 0 awake → 1 asleep ("let go")
    this.drowseTarget = 0;
    this.bpm = 64;
    this.bpmTarget = 64;
    this.beatClock = 0;
    this.pulse = 0;              // 1 on beat, exponential decay
    this.onBeat = null;
    this._softClock = 0;
    this._vars = {};
    this._titleOn = true;
    this._titleTimer = setInterval(() => {
      // the tab breathes — but not for reduced-motion users, not while
      // hidden, and not once the organism has been let go to sleep
      if (this.isReduced() || document.hidden || this.drowse > 0.9) return;
      this._titleOn = !this._titleOn;
      document.title = this._titleOn ? 'ANIMA ●' : 'ANIMA ○';
    }, 2500);
  }

  impulse(amount) {
    this.impulseEnergy = Math.min(1, this.impulseEnergy + amount);
  }

  // The organism falls asleep in your fingertips: response lag grows,
  // heartbeat slows. Drowsiness is felt as latency, not just shown.
  letGo() {
    this.drowseTarget = 1;
    this.bpmTarget = 40;
  }

  update(dt, scrollSpeed, pointerSpeed) {
    const reduced = this.isReduced();
    this.impulseEnergy *= Math.exp(-dt / 0.8);
    const raw = reduced ? 0 : Math.min(1,
      Math.min(scrollSpeed, 2500) / 2500 +
      0.3 * Math.min(pointerSpeed, 3000) / 3000 +
      this.impulseEnergy);

    this.drowse += (this.drowseTarget - this.drowse) * (1 - Math.exp(-dt / 6));
    const rise = this.riseTau * (1 + 5.7 * this.drowse);   // 0.18s → ~1.2s
    const fall = this.decayTau * (1 + 1.8 * this.drowse);  // 0.9s → ~2.5s
    const tau = raw > this.agitation ? rise : fall;
    this.agitation += (raw - this.agitation) * (1 - Math.exp(-dt / tau));

    this.breathFreq = 0.2 * (1 + 1.5 * this.agitation) * (1 - 0.45 * this.drowse);
    this.breathPhase += Math.PI * 2 * this.breathFreq * dt;
    this.breath = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(this.breathPhase);

    this.bpm += (this.bpmTarget - this.bpm) * (1 - Math.exp(-dt / 3));
    const interval = 60 / (this.bpm + 18 * this.agitation);
    this.beatClock += dt;
    if (this.beatClock >= interval) {
      this.beatClock %= interval;
      this.pulse = 1;
      if (this.onBeat) this.onBeat();
    }
    this.pulse *= Math.exp(-dt / 0.16);

    // The only rAF DOM write — --soft, the single CSS-consumed variable.
    // Everything else reads agitation/breath/pulse directly from this module.
    this._softClock += dt;
    if (this._softClock > 1 / 30) {      // SOFT axis: integer steps at 30Hz
      this._softClock = 0;
      this.setVar('--soft', String(reduced ? 50 : Math.round(this.breath * 100)));
    }
  }

  setVar(name, value) {
    if (this._vars[name] === value) return;
    this._vars[name] = value;
    this.root.style.setProperty(name, value);
  }
}
