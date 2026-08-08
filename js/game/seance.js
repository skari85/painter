/**
 * seance.js — THE SÉANCE.
 *
 * A crystal ball in the garret. The dead masters take your calls.
 * Not a duel — a hotline: pick a ghost, get lines, occasionally a blessing.
 */

import { pick } from '../core/utils.js';

export const DEAD_ARTISTS = [
  {
    id: 'vincent', name: 'Vincent', full: 'Vincent van Gogh', color: '#e8c15a',
    greeting: 'The static smells of sunflowers. Vincent is in.',
    lines: [
      'The stars were easy. It was the rent that swirled.',
      'Paint the wound, but give it good light.',
      'They called it madness. Back then it was called Tuesday in Arles.',
      'The ear? A performance piece. Ahead of the market. It still whistles.',
      'Yellow is the only honest color. The rest are negotiating.',
      'Sell nothing. Starve politely. Become priceless. Terrible plan. It worked.',
      'I painted my room so I\'d have somewhere to be. You\'re doing the same. Good.',
      'A critic once told me to calm down. I ate the review. Metaphorically. Mostly.',
      'Thick paint is just paint that refuses to be ignored. Be thick paint.',
      'Someone is buying you someday for too much money. Forgive them already.',
    ],
  },
  {
    id: 'jeanmichel', name: 'Jean-Michel', full: 'Jean-Michel Basquiat', color: '#e05d4e',
    greeting: 'A crown flickers in the glass. Jean-Michel nods once.',
    lines: [
      'The crown was rent I paid on history.',
      'Cross it out so they look longer. That\'s the whole trick.',
      'SAMO is not done. SAMO is never done.',
      'They put my scream in a vault and called it an asset. Haunt accordingly.',
      'Make it look like a kid did it — but only if you\'re very, very grown.',
      'Every wall I ever painted on got gentrified. You\'re welcome. Sorry.',
      'The notebook is the painting. The painting is the receipt.',
      'Boom for real. That\'s the review you want. Boom. For real.',
      'They\'ll love you loudest slightly too late. Schedule accordingly.',
    ],
  },
  {
    id: 'frida', name: 'Frida', full: 'Frida Kahlo', color: '#7fb285',
    greeting: 'Marigolds, somewhere far away. Frida raises one brow.',
    lines: [
      'Paint your pain small enough to hang, big enough to accuse.',
      'The corset was plaster. The plaster was a canvas. The canvas was a warning.',
      'They asked me to smile in portraits. I painted more eyebrows.',
      'Suffering is not a style, mijo. It is a material. Use it before it uses you.',
      'Feet, what do I need you for — they\'ll carry you to the gallery anyway.',
      'Monkeys are better company than collectors. Monkeys know it and don\'t invest.',
      'Your spine will betray you. Your line never has to.',
      'Keep the unibrow. Whatever your unibrow is. Keep it.',
    ],
  },
  {
    id: 'edvard', name: 'Edvard', full: 'Edvard Munch', color: '#8a5cf6',
    greeting: 'A long fjord-grey silence. Then, softly: “Hallooo.” Edvard is here.',
    lines: [
      'The Scream was a self-portrait of my hangover.',
      'I painted the same bridge until it confessed.',
      'Oslo light is a rumor you can paint. Try. Carefully.',
      'Anxiety, handled correctly, is just color with a pulse.',
      'They whispered I was mad. I was Norwegian. There is paperwork for the difference.',
      'The sun kept setting. I kept invoicing it.',
      'Dance with the ones who leave. Paint the dancing, not the leaving.',
      'My canvases lived in the snow for a winter. It improved them and the snow.',
      'Do not explain the painting. Let it stand there, pale and enormous, like a fjord.',
    ],
  },
  {
    id: 'georgia', name: 'Georgia', full: 'Georgia O’Keeffe', color: '#d98cff',
    greeting: 'The desert hums a single low note. Georgia is listening.',
    lines: [
      'I painted flowers big so busy men would have to stop.',
      'A flower is a landscape that minds its business.',
      'The desert doesn\'t care about your opening. Good.',
      'Men explained my flowers to me for sixty years. The flowers never once apologized.',
      'Bones bleach clean in the sun. So does intention.',
      'Fill the whole canvas. Half measures are for hotels.',
      'Move somewhere quiet and let the loud world come find you. It will. Charge admission.',
      'Color is a decision you make with your whole spine.',
    ],
  },
];

/** One crystal-ball session with one ghost. */
export class SeanceSession {
  constructor(artist) {
    this.artist = artist;
    this.asked = 0;
    this.#remaining = [...artist.lines];
  }

  #remaining;

  greet() { return this.artist.greeting; }

  /** Next line; null when the connection fades (pool exhausted). */
  ask() {
    this.asked++;
    if (!this.#remaining.length) {
      return pick([
        'The glass clouds over. The connection is billable now.',
        'Silence, then distant turpentine. They\'re gone for tonight.',
        'The ball shows only your own face, looking tired. Rude. Accurate.',
      ]);
    }
    const line = pick(this.#remaining);
    this.#remaining.splice(this.#remaining.indexOf(line), 1);
    return line;
  }

  /** Small blessing after a real conversation. */
  get blessingDue() { return this.asked === 3; }
}
