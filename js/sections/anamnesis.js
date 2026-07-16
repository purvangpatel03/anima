// 06 / ANAMNESIS — the finale earns the whole site. The first warm color.
// Your entire visit replays as a bioluminescent ghost with the hesitations
// preserved, annotated like lab notes. Then it names you, offers you the
// record, and — if you let it — goes back to sleep.
import { Spring } from '../lib/spring.js';
import { buildSpecimenSVG } from '../lib/svg-artifact.js';
import { FLAG } from '../recorder.js';

const REPLAY_SECONDS = 12;
const HOLD = 0.6;

export class Anamnesis {
  constructor(ctx, sec) {
    this.ctx = ctx;
    this.sec = sec;
    this.canvas = sec.querySelector('canvas.stage');
    this.g = this.canvas.getContext('2d');
    this.wrap = sec.querySelector('.stage-wrap');
    this.ecgPath = sec.querySelector('.ecg path');
    this.notesEl = sec.querySelector('.annotations');
    this.heart = sec.querySelector('.heart');
    this.awake = false;
    this.started = false;
    this.replayT = -2.5;          // negative = the heartbeat gets the room first
    this.schedule = null;
    this.drawIdx = 0;
    this.ecgReveal = 0;
    this.beats = 0;
    this.pulseSpring = new Spring(90, 16, 1);
    this.fixateT = -1;
    this.letGone = false;
    this.annotations = [];
    this.actionsReady = false;

    this.onBeat = () => {
      if (!this.awake) return;
      this.beats++;
      this.pulseSpring.impulse(2.6);
    };

    this.fixateBtn = sec.querySelector('#fixate');
    this.keepBtn = sec.querySelector('#keep');
    this.letGoBtn = sec.querySelector('#letgo');
    this.replayBtn = sec.querySelector('#replay-visit');
    this.status = sec.querySelector('#specimen-status');
    this.actions = [this.replayBtn, this.fixateBtn, this.keepBtn, this.letGoBtn].filter(Boolean);
    for (const btn of this.actions) btn.disabled = true;
    this.lastCountdown = -1;
    this.fixateBtn.addEventListener('click', () => this.fixate());
    this.keepBtn.addEventListener('click', () => this.download());
    this.letGoBtn.addEventListener('click', () => this.letGo());
    this.replayBtn.addEventListener('click', () => this.restartReplay());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.cancelFixate();
    });

    // The replay must not fire into an empty room: `awake` triggers a whole
    // viewport early (rootMargin pre-warms canvases), so the finale waits
    // until the stage itself is genuinely in front of the visitor.
    this.inSight = false;
    const sightIO = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          this.inSight = true;
          sightIO.disconnect();
        }
      }
    }, { threshold: 0.35 });
    sightIO.observe(this.wrap);

    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = this.wrap.clientWidth, h = this.wrap.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    this.g.fillStyle = '#060B0D';
    this.g.fillRect(0, 0, w, h);
  }

  // Build the compressed timeline: 12s, with your real hesitations kept
  // proportionally — hesitation must read as hesitation.
  begin() {
    if (this.started) return;
    this.started = true;
    this.sec.classList.add('lit');
    this.ctx.nervous.onBeat = this.onBeat;
    this.buildTimeline();
  }

  buildTimeline() {
    const journey = this.ctx.recorder.journey();
    this.journey = journey;
    const hes = this.ctx.recorder.hesitations(journey);
    const holdAt = new Set(hes.slice(0, 3).map((h) => h.index));
    const m = Math.max(1, journey.length);
    const base = (REPLAY_SECONDS - holdAt.size * HOLD) / m;
    let rt = 0;
    this.schedule = journey.map((p, i) => {
      rt += base;
      if (holdAt.has(i)) rt += HOLD;
      return { x: p.x, y: p.y, rt, flag: p.flag };
    });

    this.buildAnnotations(hes);
  }

  // The organism never stopped watching: rebuild the timeline from the
  // latest recording (the first replay is now part of your visit) and run it.
  restartReplay() {
    this.replayT = -0.8;
    this.drawIdx = 0;
    this.staticDrawn = false;
    this.g.fillStyle = '#060B0D';
    this.g.fillRect(0, 0, this.w, this.h);
    this.buildTimeline();
    if (this.status) this.status.textContent = 'REPLAYING YOUR VISIT AGAIN.';
    this.ctx.nervous.impulse(0.2);
  }

  buildAnnotations(hes) {
    const rec = this.ctx.recorder;
    const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;
    // the things you DID always make the record; hesitations fill what's left
    const events = [];
    const pokeSample = this.journey.find((p) => p.flag === FLAG.POKE);
    if (rec.pokes > 0 && pokeSample) {
      events.push({
        x: pokeSample.x, y: pokeSample.y, t: pokeSample.t,
        text: rec.pokes === 1 ? 'YOU POKED THE MEMBRANE — ONCE' : `YOU POKED THE MEMBRANE — ${rec.pokes} TIMES`,
      });
    }
    if (rec.fedWord) {
      const w = this.journey.find((p) => p.flag === FLAG.WORD) || { x: 0.5, y: 0.5, t: 0 };
      events.push({ x: w.x, y: w.y, t: w.t, text: `IT SPELLED YOUR WORD — "${rec.fedWord}"` });
    }
    if (rec.deposits > 0) {
      const d = this.journey.find((p) => p.flag === FLAG.DEPOSIT) || { x: 0.5, y: 0.7, t: 0 };
      events.push({ x: d.x, y: d.y, t: d.t, text: `YOU FED THE NETWORK — ${rec.deposits} DEPOSIT${rec.deposits > 1 ? 'S' : ''}` });
    }
    const hesNotes = hes.slice(0, Math.max(0, 5 - events.length)).map((h) => (
      { x: h.x, y: h.y, t: h.t, text: `YOU HESITATED HERE — ${fmt(h.t)}` }
    ));
    const list = [...events, ...hesNotes];
    this.annotations = list.sort((a, b) => a.t - b.t).slice(0, 5);
    this.notesEl.textContent = '';
    const placed = [];
    for (const n of this.annotations) {
      let px = Math.min(78, Math.max(2, n.x * 100));
      let py = Math.min(88, Math.max(4, n.y * 100));
      // notes at the same spot stack downward instead of colliding
      for (let guard = 0; guard < 8; guard++) {
        const hit = placed.find((p) => Math.abs(p.px - px) < 24 && Math.abs(p.py - py) < 9);
        if (!hit) break;
        py += 9;
        if (py > 88) { py = Math.max(4, py - 27); px = Math.min(78, px + 26); }
      }
      placed.push({ px, py });
      const el = document.createElement('p');
      el.className = 'note';
      el.textContent = n.text;
      el.style.left = px + '%';
      el.style.top = py + '%';
      n.el = el;
      this.notesEl.appendChild(el);
    }
  }

  update(dt, t) {
    if (!this.awake) return;
    if (!this.started) {
      if (!this.inSight) return; // wait until the stage is truly watched
      this.begin();
    }
    const reduced = this.ctx.reduced();

    // heartbeat scale — the QRS spike kicks a spring
    this.pulseSpring.update(dt);
    if (!reduced) {
      this.heart.style.transform = `scale(${Math.max(0.6, this.pulseSpring.x).toFixed(3)})`;
    }

    // ECG draws itself over the first 8 beats
    const targetReveal = reduced ? 1 : Math.min(1, this.beats / 8);
    this.ecgReveal += (targetReveal - this.ecgReveal) * (1 - Math.exp(-dt / 0.4));
    this.ecgPath.style.strokeDashoffset = String(Math.round(1000 * (1 - this.ecgReveal)));

    // replay clock
    this.replayT += dt;
    const rt = this.replayT;
    const visitSpan = Math.max(1, this.journey?.[this.journey.length - 1]?.t || 1);
    for (const n of this.annotations) {
      if (!n.shown && n.rtShown === undefined) {
        n.rtShown = (n.t / visitSpan) * REPLAY_SECONDS;
      }
      if (!n.shown && (reduced || rt >= n.rtShown)) {
        n.shown = true;
        n.el.classList.add('show');
      }
    }
    if (rt > REPLAY_SECONDS + 0.8) this.revealActions();

    // opt-in afterimage countdown — DOM written once per second, not per frame
    if (this.fixateT >= 0) {
      this.fixateT += dt;
      const left = Math.max(0, 10 - Math.floor(this.fixateT));
      if (left > 0) {
        if (left !== this.lastCountdown) {
          this.lastCountdown = left;
          this.fixateBtn.textContent = `KEEP YOUR EYES ON THE PULSE — ${left}`;
        }
      } else if (!this.flashed) {
        this.flashed = true;
        this.flash();
      }
    }
  }

  draw() {
    if (!this.started) return;
    const g = this.g;
    const reduced = this.ctx.reduced();

    if (reduced) {
      // the whole path at once: a static constellation
      if (this.staticDrawn) return;
      this.staticDrawn = true;
      g.fillStyle = '#060B0D';
      g.fillRect(0, 0, this.w, this.h);
      g.strokeStyle = 'rgba(94,242,214,0.5)';
      g.lineWidth = 1.2;
      g.beginPath();
      this.schedule.forEach((s, i) => {
        const x = s.x * this.w, y = s.y * this.h;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.stroke();
      this.revealActions();
      return;
    }

    // fading trail + glowing head
    g.fillStyle = 'rgba(6,11,13,0.06)';
    g.fillRect(0, 0, this.w, this.h);
    const rt = this.replayT;
    if (rt <= 0 || !this.schedule.length) return;

    g.strokeStyle = 'rgba(94,242,214,0.7)';
    g.lineWidth = 1.4;
    g.lineCap = 'round';
    g.beginPath();
    let moved = false;
    while (this.drawIdx < this.schedule.length - 1 && this.schedule[this.drawIdx + 1].rt <= rt) {
      const a = this.schedule[this.drawIdx];
      const b = this.schedule[this.drawIdx + 1];
      if (!moved) { g.moveTo(a.x * this.w, a.y * this.h); moved = true; }
      g.lineTo(b.x * this.w, b.y * this.h);
      this.drawIdx++;
    }
    if (moved) g.stroke();

    // the glow head breathes at the current point
    const cur = this.schedule[Math.min(this.drawIdx, this.schedule.length - 1)];
    if (rt < REPLAY_SECONDS + 1) {
      const x = cur.x * this.w, y = cur.y * this.h;
      const grad = g.createRadialGradient(x, y, 0, x, y, 14);
      grad.addColorStop(0, 'rgba(94,242,214,0.9)');
      grad.addColorStop(1, 'rgba(94,242,214,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, 14, 0, Math.PI * 2);
      g.fill();
    }
  }

  revealActions() {
    if (this.actionsReady) return;
    this.actionsReady = true;
    this.sec.classList.add('replayed');
    for (const btn of this.actions) btn.disabled = false;
  }

  fixate() {
    if (this.ctx.reduced() || this.fixateT >= 0) return;
    this.fixateT = 0;
    this.flashed = false;
    this.ctx.nervous.bpmTarget = 56; // hold steady while you stare
  }

  cancelFixate() {
    if (this.fixateT < 0) return;
    // kill any in-flight flash timers so a stale one can't reset a re-armed countdown
    if (this._flashTimers) {
      for (const t of this._flashTimers) clearTimeout(t);
      this._flashTimers = null;
    }
    this.fixateT = -1;
    this.flashed = false;
    this.lastCountdown = -1;
    const overlay = document.getElementById('afterimage');
    overlay.classList.remove('on', 'caption-on');
    this.fixateBtn.textContent = 'FIXATE ON THE PULSE — 10S';
    if (!this.letGone) this.ctx.nervous.bpmTarget = 64;
  }

  // One hard cut to white. Your own photoreceptors render the organism's
  // ghost in cyan. Strictly opt-in; a single cut, no strobe.
  flash() {
    const overlay = document.getElementById('afterimage');
    overlay.classList.add('on');
    this._flashTimers = [];
    this._flashTimers.push(setTimeout(() => overlay.classList.add('caption-on'), 2000));
    this._flashTimers.push(setTimeout(() => {
      overlay.classList.remove('on', 'caption-on');
      this.fixateT = -1;
      this.flashed = false;
      this.lastCountdown = -1;
      this.fixateBtn.textContent = 'FIXATE ON THE PULSE — 10S';
      if (!this.letGone) this.ctx.nervous.bpmTarget = 64;
    }, 4500));
  }

  download() {
    const svg = buildSpecimenSVG(this.journey || this.ctx.recorder.journey(), this.ctx.recorder, this.annotations);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anima-specimen.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    if (this.status) this.status.textContent = 'YOUR SPECIMEN RECORD WAS PREPARED.';
  }

  letGo() {
    if (this.letGone) return;
    this.letGone = true;
    this.ctx.nervous.letGo();
    this.ctx.organism.classList.add('asleep');
    this.letGoBtn.textContent = 'IT IS SLEEPING NOW';
    this.letGoBtn.disabled = true;
  }
}
