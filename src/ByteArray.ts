// deno-lint-ignore-file ban-types no-explicit-any

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type TypeAsString = `string` | `byte` | `float` | `int` | `float4` | `bool` | `struct`;

export type TypeFromString = {
  string: string;
  byte: number;
  float: number;
  float4: number;
  int: number;
  bool: boolean;
  struct: object;
} & { [k: string]: Uint8Array };

export type DecodeField = { name: string } & (
  | ({ type: `byte` | `float` | `int` | `float4`; } & ({ bits: number; } | { bytes: number; }))
  | ({ type: `string`; bytes?: number; })
  | ({ type: `bool`; } & ({ bits: number; } | { bytes: number; }))
  | ({ type: `struct`; description: DecodeDescription; } & ({ bits: number; } | { bytes: number; }))
);

export type DecodeDescription = readonly Prettify<DecodeField>[];

type Duples2Obj<D extends [string, unknown][], A extends object = {}> =
  D[`length`] extends 0
    ? A
    : D extends [infer H extends [string, unknown], ...(infer T extends [string, unknown][])]
      ? Duples2Obj<T, A & { [K in `${H[0]}`]: H[1] extends [string, unknown][] ? Prettify<Duples2Obj<H[1]>> : H[1]; }>
      : A;

type DuplesFormDecodeDescription<DD extends DecodeDescription> = {
  // @ts-expect-error ts(2536)
  -readonly [K in keyof DD]: [DD[K][`name`], DD[K][`type`] extends `struct` ? DD[K][`description`] extends DecodeDescription ? DuplesFormDecodeDescription<DD[K][`description`]> : never : TypeFromString[DD[K][`type`]]];
};

export type DecoderOutput<DD extends DecodeDescription> = Prettify<Duples2Obj<DuplesFormDecodeDescription<DD>>>;
//const toFloat1 = (value) => { const bits = (value[3] << 24) | (value[2] << 16) | (value[1] << 8) | value[0]; const sign = bits >>> 31 === 0 ? 1.0 : -1.0; const e = (bits >>> 23) & 0xff; const m = e === 0 ? (bits & 0x7fffff) << 1 : (bits & 0x7fffff) | 0x800000; return (sign * m * Math.pow(2, e - 150)); };

export abstract class Bytes {
  static to<T extends TypeAsString>(type: T): (value: Uint8Array) => TypeFromString[T] | void {
    return function(value: Uint8Array): TypeFromString[T] | void {
      switch (type) {
        case `string`:
          return new TextDecoder().decode(value) as TypeFromString[T];
        case `byte`:
          return value[0] as TypeFromString[T];
        case `int`:
          return (value[0] | (value[1] << 8) | (value[2] << 16) | (value[3] << 24)) as TypeFromString[T];
        case `float4`:
        case `float`: {
          const bits = (value[3] << 24) | (value[2] << 16) | (value[1] << 8) | value[0];
          const sign = bits >>> 31 === 0 ? 1.0 : -1.0;
          const e = (bits >>> 23) & 0xff;
          const m = e === 0 ? (bits & 0x7fffff) << 1 : (bits & 0x7fffff) | 0x800000;
          return (sign * m * Math.pow(2, e - 150)) as TypeFromString[T];
        }
        case `bool`: {
          return value[0] > 0 as TypeFromString[T];
        }
        default:
          return console.log(`Decode of type ${type} not implemented`, { context: `ByteArray Decode` });
      }
    };
  }

  /*
  const func = (offset, bits) => { return (v) => { const start_byte = Math.floor(offset/8); const start_bit = offset%8; const required_size = Math.ceil((offset + bits)/8); const end_bit = 0; let val = 0; for(let i=start_byte; i < required_size; i++) { for(let j=(i==start_byte ? start_bit : 0); j < (i==required_size ? end_bit : 8); j++) val |= v[i] & (1<<j); } return new Uint8Array([val]);}};
  const f1 = (offset, bits) => { return (v) => { const start_byte = Math.floor(offset/8); const start_bit = offset%8; const required_size = Math.ceil((offset + bits)/8); const end_bit = 0; let val = 0; for(let i=start_byte; i < required_size; i++) { const start = (i==start_byte ? start_bit : 0); const end = (i==required_size ? end_bit : 8); for(let j=start; j <= end; j++) val |= v[i]<<(i-start) & (1<<(j+(i-start)*8)); } return new Uint8Array([val]); }};
  
          5                 66              0
  [0,0,0,0,0,1,0,1][0,1,0,0,0,0,1,0][0,0,0,0,0,0,0,0]

  f(5,2) := 2
  f(5,3) := 5
  f(9,1) := 1
  f(9,6) := 33

  */

  //static bitwise_to<T extends TypeAsString>(type: T): (offset: number, bits: number) => (value: Uint8Array) => TypeFromString | void {
  //  return (offset, bits) => {
  //    return (v) => {
  //      const start_byte = Math.floor(offset/8);
  //      const start_bit = offset%8;
  //      const required_size = Math.ceil((offset + bits)/8);
  //      const end_bit = 0;
  //      let val = 0;
  //      for(let i=start_byte; i < required_size; i++) {
  //        const start = (i==start_byte ? start_bit : 0);
  //          const end = (i==required_size ? end_bit : 8);
  //        for(let j=start; j <= end; j++)
  //          val |= v[i]<<(i-start) & (1<<(j+(i-start)*8));
  //      }
  //
  //      const value = new Uint8Array([val]);
  //
  //      switch (type) {
  //        case `string`:
  //          return Buffer.from(value).toString() as TypeFromString[T];
  //        case `byte`:
  //          return value[0] as TypeFromString[T];
  //        case `int`:
  //          return (value[0] | (value[1] << 8) | (value[2] << 16) | (value[3] << 24)) as TypeFromString[T];
  //        case `float`: {
  //          const bits = (value[3] << 24) | (value[2] << 16) | (value[1] << 8) | value[0];
  //          const sign = bits >>> 31 === 0 ? 1.0 : -1.0;
  //          const e = (bits >>> 23) & 0xff;
  //          const m = e === 0 ? (bits & 0x7fffff) << 1 : (bits & 0x7fffff) | 0x800000;
  //          return (sign * m * Math.pow(2, e - 150)) as TypeFromString[T];
  //        }
  //        default:
  //          return log.debug(`Decode of type ${type} not implemented`, { context: `ByteArray Decode` });
  //
  //      }
  //    };
  //  };
  //}

  static from<T extends TypeAsString>(type: T): (value: TypeFromString[T]) => Uint8Array {
    return function(value: TypeFromString[T]): Uint8Array {
      switch (type) {
        case `string`:
          return new TextEncoder().encode(value as string);
        case `byte`:
          return Uint8Array.from([value as number]);
        case `int`: {
          const arr = new ArrayBuffer(4);
          new Int32Array(arr)[0] = value as number;
          return new Uint8Array(arr);
        }
        case `bool`: {
          return new Uint8Array([ (value as boolean) ? 1 : 0 ]);
        }
        case `float`: {
          const arr = new ArrayBuffer(8);
          const view = new DataView(arr);
          view.setFloat64(0, value as number, true);
          return new Uint8Array(arr);
        }
        case `float4`: {
          const arr = new ArrayBuffer(4);
          const view = new DataView(arr);
          view.setFloat32(0, value as number, true);
          return new Uint8Array(arr);
        }
        case `struct`: {
          const v = value as object;
          v;
          // TODO: implement
          return new Uint8Array(0);
        }
        default:
          return new Uint8Array();
      }
    };
  }

  static padding(size: number): (value: Uint8Array) => Uint8Array {
    return function(value: Uint8Array): Uint8Array {
      return new Uint8Array([...value, ...new Uint8Array(size - value.length)]);
    };
  }

  static toBase64(value: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < value.length; i++) {
      binary += String.fromCharCode(value[i]);
    }
    return btoa(binary);
  }
}

type Uint8ArrayPosition = { byte: number, bit: number };
const Uint8Array_pos = (count: number): Uint8ArrayPosition => ({
  byte: Math.floor(count / 8),
  bit: count % 8
});

function Uint8Array_bit_at(v: Uint8Array, pos: Uint8ArrayPosition): number {
  return (v[pos.byte] >> (7 - pos.bit)) & 1;
}

export function reframe_(offset: number, bits: number): (value: Uint8Array) => Uint8Array {

  return (v) => {
    const required_size = Math.ceil(bits / 8);
    const result = new Uint8Array(Math.ceil(bits / 8));

    const end = offset - 1 + bits;

    for (let i = 0; i < bits; i++) {
      const src_pos = Uint8Array_pos(end - i);
      const dest_pos = Uint8Array_pos(required_size * 8 - i - 1);

      result[dest_pos.byte] |= Uint8Array_bit_at(v, src_pos) << (7 - dest_pos.bit);
    }

    return result; //.reverse();
  };
};


export const reframe = (offset: number, bits: number) => {
  return (v: Uint8Array) => {
    const required_size = Math.ceil(bits / 8);
    //print({ offset, bits, required_size });
    const result = new Uint8Array(Math.ceil(bits / 8));

    const end = offset - 1 + bits;

    for (let i = 0; i < bits; i++) {
      const src_pos = Uint8Array_pos(end - i);
      const dest_pos = Uint8Array_pos(required_size * 8 - i - 1);

      //print(`src[${src_pos.byte}][${src_pos.bit}] --> dest[${dest_pos.byte}][${dest_pos.bit}]`);
      //print(str_pad(8, `0`, `>`)((v[src_pos.byte] ?? 0).toString(2)));

      result[dest_pos.byte] |= (Uint8Array_bit_at(v, src_pos)) << (7 - dest_pos.bit);
    }

    return (result.reverse());
  };
};

export function _reframe(offset: number, bits: number): (value: Uint8Array) => Uint8Array {
  return (v) => {
    const required_size = Math.ceil(bits / 8);
    const result = new Uint8Array(required_size);

    for (let i = 0; i < required_size; i++) {
      result[i] = v[i+offset];
    }
    return result;

  };
}

export function strlen(buff: Uint8Array): number {
  for (let i = 0; i < buff.length; i++) if (buff[i] == 0) return i;
  return buff.length;
}

// TODO: deal with floats, ints and other types
export function decoder<T extends DecodeDescription>(desc: T): (value: Uint8Array) => DecoderOutput<T> {
  let pos = 0;
  return value => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return desc.map(<R extends DecoderOutput<T>>(d: DecodeField): [keyof R, any] => {
      let size = `bits` in d && d.bits ? d.bits : `bytes` in d && d.bytes ? d.bytes * 8 : -1;
      const name = d.name as keyof DecoderOutput<T>;

      if (d.type == `string` && size < 0) size = strlen(value.subarray(pos));

      // TODO: deal with struct without size
      //print(d.name);
      //print(`=`);
      //print(d.type);
      const val = d.type == `struct` ? decoder(d.description)(value.subarray(pos)) : Bytes.to(d.type)(reframe(pos, size)(value));
      //print(`\n\n`);

      pos += size;

      return [name, val];
    }).reduce((a, dup) => { a[dup[0]] = dup[1]; return a; }, {} as DecoderOutput<T>);
  };
};

// TODO: encoder
export function encoder<T extends DecodeDescription>(desc: T): (value: DecoderOutput<T>) => Uint8Array {
  let pos = 0;
  return value => {
    const sz = desc.reduce((a,d) => a + (`bits` in d && d.bits ? d.bits : `bytes` in d && d.bytes ? d.bytes * 8 : (value[d.name as keyof DecoderOutput<T>] as string).length ), 0);
    const ret = new Uint8Array(Math.ceil(sz/8));

    //return new Uint8Array(desc.flatMap((d: DecodeField): number[] => {
    //  const name = d.name as keyof DecoderOutput<T>;
    //  const size = `bits` in d && d.bits ? d.bits : `bytes` in d && d.bytes ? d.bytes * 8 : (value[d.name as keyof DecoderOutput<T>] as string).length ;
    //
    //  const val = d.type == `struct`
    //    ? encoder(d.description)(value[name] as object)
    //    : Bytes.from(d.type)(value[name] as string | number | boolean);
    //
    //  for(let i = size - 1; i >= 0; i--) {
    //    const dest_pos = Uint8Array_pos(pos+i);
    //    const src_pos = Uint8Array_pos(val.length * 8 - (size - i));
    //    ret[dest_pos.byte] |= Uint8Array_bit_at(val, src_pos) >> dest_pos.bit;
    //  }
    //
    //
    //  pos += size;
    //  const field = value[d.name as keyof DecoderOutput<T>] as string | number | boolean;//TypeFromString[TypeAsString];
    //  return [...(d.type == `struct` ? encoder(d.description)(field) : Bytes.from(d.type)(field))];
    //
    //}));
    
    desc.forEach((d: DecodeField) => {
      const name = d.name as keyof DecoderOutput<T>;
      const size = `bits` in d && d.bits ? d.bits : `bytes` in d && d.bytes ? d.bytes * 8 : (value[d.name as keyof DecoderOutput<T>] as string).length ;
      
      const val = d.type == `struct`
        ? encoder(d.description)(value[name] as object)
        : Bytes.from(d.type)(value[name] as string | number | boolean);

      for(let i = size - 1; i >= 0; i--) {
        const dest_pos = Uint8Array_pos(pos+i);
        const src_pos = Uint8Array_pos(val.length * 8 - (size - i));
        ret[dest_pos.byte] |= Uint8Array_bit_at(val, src_pos) << dest_pos.bit;
      }

      pos += size;
    });
    return ret;
  };
};
