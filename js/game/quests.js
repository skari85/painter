/**
 * quests.js — the three nights.
 *
 * NIGHT ONE    paint · hang it at the Bianca · face Victoria's appraisal
 * NIGHT TWO    paint again · the critic's verdict · break (or save) KREYO
 * NIGHT THREE  the gold invitation · The Vault · Mister Index
 *
 * The director owns objectives and endings; it never touches rendering.
 * Game events flow in via notify(); intentions flow out via events.
 */

import { Emitter } from '../core/utils.js';

const NIGHT_TITLES = { 1: 'NIGHT ONE', 2: 'NIGHT TWO', 3: 'NIGHT THREE' };

export class QuestDirector extends Emitter {
  #state;

  constructor(state) {
    super();
    this.#state = state;
    this.stepIndex = 0;
    this.steps = [];
  }

  get currentStep() { return this.steps[this.stepIndex] ?? null; }
  /** 'roam' is explicitly optional — the bed accepts pacifists too. */
  get bedArmed() { return ['bed', 'roam'].includes(this.currentStep?.id); }


  startNight(n) {
    this.#state.night = n;
    this.stepIndex = 0;
    this.steps = this.#planFor(n);
    if (n === 3) this.#state.setFlag('vaultOpen');
    this.#announce();
  }

  #planFor(n) {
    switch (n) {
      case 1:
        return [
          { id: 'paint', text: 'Paint something at the easel. Anything. Mean it.' },
          { id: 'hang', text: 'Carry it to Galleria Bianca. Hang it on your reserved wall.' },
          { id: 'appraisal', text: 'Face Victoria Vane and her twelve percent.' },
          { id: 'roam', text: 'The opening is yours. Duel, splatter, or behave. Your call.' },
          { id: 'bed', text: 'Sleep it off. The mattress misses you.' },
        ];
      case 2:
        return [
          { id: 'paint', text: 'Paint again. Better, maybe. Truer, ideally.' },
          { id: 'hang', text: 'Hang the new piece at the Bianca.' },
          { id: 'review', text: 'Dolores Pang is here. Get reviewed — or review her back.' },
          { id: 'kreyo', text: 'KREYO has been talking. End the conversation.' },
          { id: 'bed', text: 'Sleep. Tomorrow has a gold envelope in it.' },
        ];
      default:
        return [
          { id: 'vault', text: 'A gold invitation. Tasteless. Heavy. Enter The Vault.' },
          { id: 'index', text: 'Mister Index is waiting on his carpet. Finish this.' },
        ];
    }
  }

  #announce() {
    const step = this.currentStep;
    this.emit('objective', {
      night: NIGHT_TITLES[this.#state.night],
      text: step?.text ?? 'Drift.',
    });
  }

  /** Main loop routes game happenings here. */
  notify(event, data = {}) {
    const step = this.currentStep;
    if (!step) return;
    const s = this.#state;

    switch (event) {
      case 'paintingFinished':
        if (step.id === 'paint') {
          // honest work cleanses; dashed-off work doesn't
          const q = data.quality;
          if (q >= 55) {
            s.shiftVirtue('craft', 8, 'You meant it');
            s.shiftVirtue('vision', 6, 'It looks like something only you could make');
            s.shiftVirtue('honesty', 5, 'No market was consulted');
            s.record('The work felt honest', null);
          } else {
            s.shiftVirtue('craft', 2, 'Paint got pushed, at least');
          }
          this.#advance();
        }
        break;

      case 'paintingHung':
        if (step.id === 'hang') {
          s.addMeter('fame', 4, 'Your work is on a white wall');
          s.record(s.night === 1
            ? 'Your work was discussed before it was seen'
            : 'The title travelled farther than the canvas', null);
          this.#advance();
        }
        break;

      case 'duelEnded': {
        const { id, outcome } = data;
        if (step.id === 'appraisal' && id === 'victoria' && outcome !== 'left') this.#advance();
        else if (step.id === 'roam' && (outcome === 'shatter' || outcome === 'disarm' || outcome === 'dismiss')) this.#advance();
        else if (step.id === 'review' && id === 'dolores' && ['shatter', 'disarm', 'dismiss'].includes(outcome)) {
          this.#resolveReview(outcome);
          this.#advance();
        } else if (step.id === 'kreyo' && id === 'kreyo' && ['shatter', 'disarm'].includes(outcome)) {
          this.#advance();
        } else if (step.id === 'index' && id === 'index' && ['shatter', 'disarm'].includes(outcome)) {
          this.emit('finale', { outcome });
        }
        break;
      }

      case 'zoneEntered':
        if (step.id === 'vault' && data.zone === 'vault') {
          s.record('Walked the red carpet', null);
          this.#advance();
        }
        break;

      case 'bedUsed':
        if (step.id === 'bed') this.emit('nightComplete');
        else if (step.id === 'roam') { this.#advance(); this.emit('nightComplete'); }
        break;

      case 'npcSplatted':
        // splattering someone counts as "participating in the opening"
        if (step.id === 'roam') this.#advance();
        break;

    }
  }

  #resolveReview(outcome) {
    const s = this.#state;
    if (outcome === 'disarm') {
      s.addMeter('fame', 12, '“A name to watch” — The Pale Review');
      s.shiftVirtue('honesty', 6, 'She actually looked');
      s.record('Dolores wrote something kind. Almost.', null);
    } else if (outcome === 'shatter') {
      s.addMeter('fame', 8, 'The feud is now content');
      s.addMeter('heat', 10, 'Critics remember');
      s.shiftVirtue('valor', 3, '');
      s.record('You broke the critic on record', null);
    } else {
      s.addMeter('fame', 3, '“Competent.” It could be worse.');
    }
  }

  #advance() {
    this.stepIndex++;
    this.emit('stepDone');
    this.#announce();
  }

  /* ---------------- appraisal script (Victoria) ---------------- */

  appraisalScript(painting, fame) {
    const q = painting.quality;
    const offer = Math.round(18 + q * 0.75 + fame * 0.35);
    const archive = this.#state.hasClue('provenanceSeen')
      ? `There is already a red dot beside “${painting.title}”. ${painting.lotNumber ?? 'A-01'} is what they call it. `
      : '';
    const opener = q >= 55
      ? `${archive}Hm. “${painting.title}”. It's... actually good. Don't let it go to your head, it's bad for the walls. ${offer} cash, and I hang it where people can see it.`
      : q >= 30
        ? `${archive}“${painting.title}”. Competent. Competence is having a moment. ${offer} cash, take it before the moment passes.`
        : `${archive}“${painting.title}”. Well. It's certainly... on canvas. I can move it as "raw". ${offer} cash, and we never speak of the process.`;
    return {
      opener,
      custom: [
        { key: '1', tone: 'kind', tag: `SELL — ${offer}€`, text: 'Take the money. The work goes into the machine.', action: `sell:${offer}` },
        { key: '2', tone: 'witty', tag: 'NEGOTIATE', text: 'Counter-offer with charm and zero leverage.', action: `negotiate:${offer}` },
        { key: '3', tone: 'brutal', tag: 'REFUSE', text: '“It\'s not for sale. It\'s not for YOU.” Walk out taller.', action: 'refuse' },
      ],
    };
  }

  resolveAppraisal(action, painting) {
    const s = this.#state;
    if (action.startsWith('sell:')) {
      const amount = Number(action.split(':')[1]);
      painting.sold = true;
      s.stats.sold++;
      s.addMeter('cash', amount, `Sold “${painting.title}”`);
      s.addMeter('fame', 6, 'You are now “collected”');
      s.shiftVirtue('integrity', -8, 'The machine ate well');
      s.shiftVirtue('sacrifice', -4, 'Exposure counts, they said');
      return { result: 'sold', line: `Sold. The painting is now “an asset with a story”. Victoria air-kisses the concept of you.` };
    }
    if (action.startsWith('negotiate:')) {
      const base = Number(action.split(':')[1]);
      if (painting.quality >= 35) {
        const amount = Math.round(base * 1.5);
        painting.sold = true;
        s.stats.sold++;
        s.addMeter('cash', amount, `“${painting.title}”, at your price`);
        s.addMeter('fame', 8, 'You out-charmed the house');
        s.shiftVirtue('integrity', -4, 'Still a sale. A stylish one.');
        return { result: 'sold', line: `She actually smiled. It looked expensive. ${amount}€. The room pretends not to be impressed.` };
      }
      s.addMeter('fame', -4, 'The counter-offer died on contact');
      return { result: 'failed', line: `“No.” One syllable, perfectly hung. Perhaps make something she can't dismiss first.` };
    }
    // refuse
    s.stats.refused++;
    s.addMeter('soul', 10, 'You kept the work');
    s.addMeter('fame', 2, 'Refusal is also a look');
    s.shiftVirtue('integrity', 10, 'Not everything is for everyone');
    s.shiftVirtue('humility', 4, '');
    s.record('Refused to sell', null);
    return { result: 'refused', line: `You take the painting back under your arm. Victoria nods, once, the way gallows nod.` };
  }

  /* ---------------- endings ---------------- */

  computeEnding() {
    const s = this.#state;
    const avg = s.virtueAverage;
    const { fame, soul, cash } = s.meters;
    if (avg >= 20) return 'ascension';
    if (fame >= 55 && soul <= 32) return 'sellout';
    if (soul >= 62 && cash <= 45) return 'purist';
    return 'walked';
  }
}
