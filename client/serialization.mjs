import * as BufferLayout from "buffer-layout";
import { serialize, deserialize } from 'borsh';
import { PublicKey } from '@solana/web3.js';


/**
 * Borsh serializations
 */

class Assignable {
  constructor(properties) {
      Object.keys(properties).map((key) => {
          this[key] = properties[key];
      });
  }
}

/**
 * Set value instruction
 */
const AnnouncementKind = 1;
const SetValueKind=2;
export class AnnouncementInstruction extends Assignable { }
const schema = new Map([[AnnouncementInstruction, { kind: 'struct', fields: [['kind', 'u8'], ['url', 'string'], ['hash', [32]]] }]]);

export const serializeAnnounceInstruction = (url, hash) => {
  const kind = SetValueKind;
  const ix = new AnnouncementInstruction({ kind, url, hash });
  return serialize(schema, ix);
}

/**
 * HAMT State
 */
export class HAMTState extends Assignable { }
export const HAMTStateSchema = new Map([
  [HAMTState, { kind: 'struct', fields: [['is_initialized', 'u8'], ['root_pubkey', [32]]] }],
]);

export const AnnounceStateSize = 41;

/**
 * HAMT Slot
 */
export class HAMTSlot extends Assignable {
  toString() {
    return `value: ${this.value.toString()}, hash: ${new PublicKey(Buffer.from(this.key_hash)).toBase58()}, link: ${new PublicKey(Buffer.from(this.link)).toBase58()}`
  }
}

/**
 * HAMT Node
 */
export class HAMTNode extends Assignable { }
export const HAMTNodeSchema = new Map([
  [HAMTSlot, { kind: 'struct', fields: [['value', 'u64'], ['key_hash', [32]], ['link', [32]]] }],
  [HAMTNode, { kind: 'struct', fields: [['values', [HAMTSlot, 16]]] }]
]);

export const HAMTNodeSize = 16*(8+32+32);

const jsArrayPrefix = new Uint8Array([16,0,0,0])
export const deserializeHAMTNode = (b) => deserialize(HAMTNodeSchema, HAMTNode, Buffer.concat([jsArrayPrefix, b]))
