/**
 * There are several things that positions can be mapped through.
 * Such objects conform to this interface.
 */
export interface Mappable {
  /**
   * Map a position through this object. When given, `assoc` (should
   * be -1 or 1, defaults to 1) determines with which side the
   * position is associated, which determines in which direction to
   * move when a chunk of content is inserted at the mapped position.
   */
  map(pos: number, assoc?: number): number;

  /**
   * Map a position, and return an object containing additional
   * information about the mapping.
   */
  mapResult(pos: number, assoc?: number): MapResult;
}

// Recovery values encode a range index and an offset.
const lower16 = 0xffff;
const factor16 = Math.pow(2, 16);

function makeRecover(index: number, offset: number): number {
  return index + offset * factor16;
}

function recoverIndex(value: number): number {
  return value & lower16;
}

function recoverOffset(value: number): number {
  return (value - (value & lower16)) / factor16;
}

const DEL_BEFORE = 1;
const DEL_AFTER = 2;
const DEL_ACROSS = 4;
const DEL_SIDE = 8;

/**
 * An object representing a mapped position with extra information.
 */
export class MapResult {
  constructor(
    /** The mapped version of the position. */
    readonly pos: number,
    /** @internal */
    readonly delInfo: number,
    /** @internal */
    readonly recover: number | null
  ) {}

  /**
   * Tells you whether the position was deleted, that is, whether the
   * step removed the token on the side queried.
   */
  get deleted(): boolean {
    return (this.delInfo & DEL_SIDE) > 0;
  }

  /** Tells you whether the token before the mapped position was deleted. */
  get deletedBefore(): boolean {
    return (this.delInfo & (DEL_BEFORE | DEL_ACROSS)) > 0;
  }

  /** True when the token after the mapped position was deleted. */
  get deletedAfter(): boolean {
    return (this.delInfo & (DEL_AFTER | DEL_ACROSS)) > 0;
  }

  /**
   * Tells whether any of the steps mapped through deletes across the
   * position (including both the token before and after the position).
   */
  get deletedAcross(): boolean {
    return (this.delInfo & DEL_ACROSS) > 0;
  }
}

/**
 * A map describing the deletions and insertions made by a step, which
 * can be used to find the correspondence between positions in the
 * pre-step version of a document and the same position in the
 * post-step version.
 */
export class StepMap implements Mappable {
  /**
   * Create a position map. The modifications to the document are
   * represented as an array of numbers, in which each group of three
   * represents a modified chunk as `[start, oldSize, newSize]`.
   */
  constructor(
    /** @internal */
    readonly ranges: readonly number[],
    /** @internal */
    readonly inverted = false
  ) {
    if (!ranges.length && StepMap.empty) return StepMap.empty;
  }

  /** @internal */
  recover(value: number): number {
    let diff = 0;
    const index = recoverIndex(value);
    if (!this.inverted) {
      for (let i = 0; i < index; i++) {
        diff += this.ranges[i * 3 + 2] - this.ranges[i * 3 + 1];
      }
    }
    return this.ranges[index * 3] + diff + recoverOffset(value);
  }

  mapResult(pos: number, assoc = 1): MapResult {
    return this._map(pos, assoc, false) as MapResult;
  }

  map(pos: number, assoc = 1): number {
    return this._map(pos, assoc, true) as number;
  }

  /** @internal */
  _map(pos: number, assoc: number, simple: boolean): number | MapResult {
    let diff = 0;
    const oldIndex = this.inverted ? 2 : 1;
    const newIndex = this.inverted ? 1 : 2;

    for (let i = 0; i < this.ranges.length; i += 3) {
      const start = this.ranges[i] - (this.inverted ? diff : 0);
      if (start > pos) break;

      const oldSize = this.ranges[i + oldIndex];
      const newSize = this.ranges[i + newIndex];
      const end = start + oldSize;

      if (pos <= end) {
        const side = !oldSize ? assoc : pos === start ? -1 : pos === end ? 1 : assoc;
        const result = start + diff + (side < 0 ? 0 : newSize);

        if (simple) return result;

        const recover =
          pos === (assoc < 0 ? start : end)
            ? null
            : makeRecover(i / 3, pos - start);
        let del = pos === start ? DEL_AFTER : pos === end ? DEL_BEFORE : DEL_ACROSS;
        if (assoc < 0 ? pos !== start : pos !== end) del |= DEL_SIDE;

        return new MapResult(result, del, recover);
      }
      diff += newSize - oldSize;
    }

    return simple ? pos + diff : new MapResult(pos + diff, 0, null);
  }

  /** @internal */
  touches(pos: number, recover: number): boolean {
    let diff = 0;
    const index = recoverIndex(recover);
    const oldIndex = this.inverted ? 2 : 1;
    const newIndex = this.inverted ? 1 : 2;

    for (let i = 0; i < this.ranges.length; i += 3) {
      const start = this.ranges[i] - (this.inverted ? diff : 0);
      if (start > pos) break;

      const oldSize = this.ranges[i + oldIndex];
      const end = start + oldSize;
      if (pos <= end && i === index * 3) return true;

      diff += this.ranges[i + newIndex] - oldSize;
    }
    return false;
  }

  /**
   * Calls the given function on each of the changed ranges included in
   * this map.
   */
  forEach(
    f: (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => void
  ): void {
    const oldIndex = this.inverted ? 2 : 1;
    const newIndex = this.inverted ? 1 : 2;

    for (let i = 0, diff = 0; i < this.ranges.length; i += 3) {
      const start = this.ranges[i];
      const oldStart = start - (this.inverted ? diff : 0);
      const newStart = start + (this.inverted ? 0 : diff);
      const oldSize = this.ranges[i + oldIndex];
      const newSize = this.ranges[i + newIndex];
      f(oldStart, oldStart + oldSize, newStart, newStart + newSize);
      diff += newSize - oldSize;
    }
  }

  /**
   * Create an inverted version of this map. The result can be used to
   * map positions in the post-step document to the pre-step document.
   */
  invert(): StepMap {
    return new StepMap(this.ranges, !this.inverted);
  }

  /** @internal */
  toString(): string {
    return (this.inverted ? "-" : "") + JSON.stringify(this.ranges);
  }

  /**
   * Create a map that moves all positions by offset `n` (which may be
   * negative).
   */
  static offset(n: number): StepMap {
    return n === 0 ? StepMap.empty : new StepMap(n < 0 ? [0, -n, 0] : [0, 0, n]);
  }

  /** A StepMap that contains no changed ranges. */
  static empty = new StepMap([]);
}

/**
 * A mapping represents a pipeline of zero or more step maps.
 * It has special provisions for losslessly handling mapping positions
 * through a series of steps in which some steps are inverted versions
 * of earlier steps.
 */
export class Mapping implements Mappable {
  private _maps: StepMap[];
  private ownData: boolean;

  constructor(
    maps?: readonly StepMap[],
    /** @internal */
    public mirror?: number[],
    /** The starting position in the `maps` array. */
    public from = 0,
    /** The end position in the `maps` array. */
    public to = maps ? maps.length : 0
  ) {
    this._maps = (maps as StepMap[]) || [];
    this.ownData = !(maps || mirror);
  }

  /** The step maps in this mapping. */
  get maps(): readonly StepMap[] {
    return this._maps;
  }

  /** Create a mapping that maps only through a part of this one. */
  slice(from = 0, to = this.maps.length): Mapping {
    return new Mapping(this._maps, this.mirror, from, to);
  }

  /**
   * Add a step map to the end of this mapping. If `mirrors` is
   * given, it should be the index of the step map that is the mirror
   * image of this one.
   */
  appendMap(map: StepMap, mirrors?: number): void {
    if (!this.ownData) {
      this._maps = this._maps.slice();
      this.mirror = this.mirror && this.mirror.slice();
      this.ownData = true;
    }
    this.to = this._maps.push(map);
    if (mirrors != null) this.setMirror(this._maps.length - 1, mirrors);
  }

  /**
   * Add all the step maps in a given mapping to this one.
   */
  appendMapping(mapping: Mapping): void {
    for (let i = 0, startSize = this._maps.length; i < mapping._maps.length; i++) {
      const mirr = mapping.getMirror(i);
      this.appendMap(
        mapping._maps[i],
        mirr != null && mirr < i ? startSize + mirr : undefined
      );
    }
  }

  /**
   * Finds the offset of the step map that mirrors the map at the
   * given offset, in this mapping.
   */
  getMirror(n: number): number | undefined {
    if (this.mirror) {
      for (let i = 0; i < this.mirror.length; i++) {
        if (this.mirror[i] === n) return this.mirror[i + (i % 2 ? -1 : 1)];
      }
    }
    return undefined;
  }

  /** @internal */
  setMirror(n: number, m: number): void {
    if (!this.mirror) this.mirror = [];
    this.mirror.push(n, m);
  }

  /** Append the inverse of the given mapping to this one. */
  appendMappingInverted(mapping: Mapping): void {
    for (
      let i = mapping.maps.length - 1, totalSize = this._maps.length + mapping._maps.length;
      i >= 0;
      i--
    ) {
      const mirr = mapping.getMirror(i);
      this.appendMap(
        mapping._maps[i].invert(),
        mirr != null && mirr > i ? totalSize - mirr - 1 : undefined
      );
    }
  }

  /** Create an inverted version of this mapping. */
  invert(): Mapping {
    const inverse = new Mapping();
    inverse.appendMappingInverted(this);
    return inverse;
  }

  /** Map a position through this mapping. */
  map(pos: number, assoc = 1): number {
    if (this.mirror) return this._map(pos, assoc, true) as number;
    for (let i = this.from; i < this.to; i++) {
      pos = this._maps[i].map(pos, assoc);
    }
    return pos;
  }

  /** Map a position through this mapping, returning a mapping result. */
  mapResult(pos: number, assoc = 1): MapResult {
    return this._map(pos, assoc, false) as MapResult;
  }

  /** @internal */
  _map(pos: number, assoc: number, simple: boolean): number | MapResult {
    let delInfo = 0;

    for (let i = this.from; i < this.to; i++) {
      const map = this._maps[i];
      const result = map.mapResult(pos, assoc);

      if (result.recover != null) {
        const corr = this.getMirror(i);
        if (corr != null && corr > i && corr < this.to) {
          i = corr;
          pos = this._maps[corr].recover(result.recover);
          continue;
        }
      }

      delInfo |= result.delInfo;
      pos = result.pos;
    }

    return simple ? pos : new MapResult(pos, delInfo, null);
  }
}
