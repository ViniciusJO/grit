// deno-lint-ignore-file ban-types no-explicit-any

export type Prettify<T> = { [K in keyof T]: T[K]; } & {};
export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

export enum Endianness { LITTLE, BIG }

export type PrimitiveAsString = `bool` | `byte` | `int` | `float` | `double` | `string`;
export type CompoundAsString = `array` | `struct`;

export type TypeAsString =  PrimitiveAsString | CompoundAsString;

export type PrimitiveTypeReference = {
  bool: boolean;
  byte: number;
  int: number;
  float: number;
  double: number;
  string: string;
}

export type CompoundTypeReference = {
  array: Array<unknown>;
  struct: object;
}

type TFS = PrimitiveTypeReference & CompoundTypeReference;

export type TypesReference = TFS;

export type Types = TFS[keyof TFS];

export type DecodeField = { name: string } & (
  | ({ type: `bool`; } & ({ bits: number; } | { bytes: number; }))
  | ({ type: `byte` | `int` | `float` | `double`; } & ({ bits: number; } | { bytes: number; }))
  | ({ type: `string`; bytes?: number; })
  | ({ type: `array`; value_description: DecodeField; size: number; })
  | ({ type: `struct`; description: DecodeDescription[]; })
);

export type DecodeDescription = DecodeField;

type DescribedObject<T extends DecodeField[]> = T[number] extends infer OBJ
  ? OBJ extends DecodeField
    ? OBJ extends { name: infer NAME extends string }
      ? { [K in NAME]: DescribedType<OBJ> } : never
    : never
  : never;

export type DescribedType<T extends DecodeDescription> =
  T extends { type: `array`, value_description: infer TYPE extends DecodeField }
    ? Array<DescribedType<TYPE>>
    : T extends { type: `struct`, description: infer DESC extends DecodeField[]}
      ? Prettify<UnionToIntersection<DescribedObject<DESC>>>
      : TypesReference[T["type"]];

export abstract class Bytes {
  static to<T extends PrimitiveAsString>(type: T): (value: Uint8Array) => PrimitiveTypeReference[T] | void {
    return function(value: Uint8Array): PrimitiveTypeReference[T] | void {
      switch (type) {
        case `bool`: {
          return value[0] > 0 as TypesReference[T];
        }
        case `byte`:
          return value[0] as TypesReference[T];
        case `int`:
          return (value[0] | (value[1] << 8) | (value[2] << 16) | (value[3] << 24)) as TypesReference[T];
        case `double`:
        case `float`: {
          const view = new DataView(
            value.buffer,
            value.byteOffset,
            value.byteLength
          );

          if (value.length === 4) {
            return view.getFloat32(0, true) as TypesReference[T];
          }
          if (value.length === 8) {
            return view.getFloat64(0, true) as TypesReference[T];
          }
          return 0 as TypesReference[T];
        }
        case `string`: {
          return new TextDecoder().decode(value) as TypesReference[T];
        }
        default:
          return console.log(`Decode of type ${type} not implemented`);
      }
    };
  }

  static from<T extends PrimitiveAsString>(type: T): (value: PrimitiveTypeReference[T]) => Uint8Array {
    return function(value: PrimitiveTypeReference[T]): Uint8Array {
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
        case `double`: {
          const arr = new ArrayBuffer(8);
          const view = new DataView(arr);
          view.setFloat64(0, value as number, true);
          return new Uint8Array(arr);
        }
        case `float`: {
          const arr = new ArrayBuffer(4);
          const view = new DataView(arr);
          view.setFloat32(0, value as number, true);
          return new Uint8Array(arr);
        }
        default:
          return new Uint8Array();
      }
    };
  }

   
  // TODO: check sizes
  static encoder<T extends DecodeDescription>(desc: T): (value: DescribedType<T>) => Uint8Array {
    return value => {
      switch(desc.type) {
        case "bool":
          case "byte":
          case "int":
          case "float":
          case "double":
          case "string": {
          // @ts-ignore no infinite recursion
          return Bytes.from(desc.type)(value);
        }
        case "array": {
          const v = value as Types[];
          if(v.length < desc.size) return new Uint8Array();
          return new Uint8Array(v.flatMap(el => [ ...Bytes.encoder(desc.value_description)(el as any) ]));
        }
        case "struct": {
          let ret = new Uint8Array();
          desc.description.forEach((d: DecodeField) => {
            const name = d.name as keyof DescribedType<T>;
            ret = new Uint8Array([ ...ret, ...Bytes.encoder(d)(value[name] as any) ]);
          });
          return ret;
        }
      }
    };
  };

  // TODO: check sizes
  static decoder<T extends DecodeDescription>(desc: T): (value: Uint8Array) => DescribedType<T> {
    let pos = 0;
    return value => {
      switch(desc.type) {
        case "bool":
          case "byte":
          case "int":
          case "float":
          case "double":
          case "string": {
          // @ts-ignore no infinite recursion
          const ret = Bytes.to(desc.type)(value);
          if(!ret) switch(desc.type) {
            case "bool": return false as DescribedType<T>;
            case "byte":
              case "int":
              case "float":
              case "double": return 0 as DescribedType<T>;
            case "string": return "" as DescribedType<T>;
          }
          return ret as DescribedType<T>;;
        }
        case "array": {
          type ElementType = T extends { value_description: infer AT } ? AT : unknown;
          const x: Array<ElementType> = [];

          const el_size = Bytes.size_in_memory(desc.value_description);
          for(let i = 0; i < desc.size; i++) {
            x.push(Bytes.decoder(desc.value_description)(value.subarray(pos, pos+el_size)) as ElementType);
            pos += el_size;
          }
          return x as DescribedType<T>;
        }
        case "struct": {
          let ret = {};
          desc.description.forEach((d: DecodeField) => {
            const name = d.name as keyof DescribedType<T>;
            const current_size = Bytes.size_in_memory(d);
            const dec = Bytes.decoder(d)(value.subarray(pos, pos + current_size)) as DescribedType<typeof d>;
            ret = { ...ret, [name]: dec };
            pos += current_size;
          });
          return ret as DescribedType<T>;
        }
      }
    };

  };

  static size_in_memory(d: DecodeField, value?: Uint8Array): number {
    switch(d.type) {
      case "bool":
        case "byte":
        case "int":
        case "float":
        case "double": {
        return `bits` in d ? Math.ceil(d.bits/8) : `bytes` in d ? d.bytes : 0;
      }
      case "string": {
        if(`bytes` in d) return d.bytes || 0;
        else if(value) {
          let count = 0;
          while(count!=value.length) {
            if(value[count] == 0) break;
            count++;
          }
          return count;
        }
        return 0;
      }
      case "array": {
        return d.size * Bytes.size_in_memory(d.value_description);
      }
      case "struct": {
        return d.description.reduce((a, e) => a + Bytes.size_in_memory(e), 0);
      }
      default: return 0;
    }
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

  static reframe_(offset: number, bits: number): (value: Uint8Array) => Uint8Array {

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

  static reframe(
    offset: number,
    bits: number,
    in_endianness: Endianness = Endianness.LITTLE,
    out_endianness: Endianness = Endianness.LITTLE
  ) {
    const print = <T>(t: T): T => { console.log(t); return t;}
    print;

    const required_size = Math.ceil(bits / 8);

    return (v: Uint8Array) => {
      const result = new Uint8Array(required_size);

      for (let i = 0; i < bits; i++) {
        const src_pos = Uint8Array_pos(offset + i);
        const dest_pos = Uint8Array_pos(i);


        result[dest_pos.byte] |=
          (Uint8Array_bit_at(v, src_pos, in_endianness)) << (dest_pos.bit);

        // print(str_pad(8, `0`, `>`)((v[src_pos.byte] ?? 0).toString(2)));

        // print(`src[${src_pos.byte}][${src_pos.bit}](${
        //   Uint8Array_bit_at(v, src_pos)
        // }) --> dest[${dest_pos.byte}][${dest_pos.bit}](${
        //   Uint8Array_bit_at(result, dest_pos)
        // })`);
      }

      switch(out_endianness) {
        case Endianness.LITTLE: return result;
        case Endianness.BIG: return (result.reverse());
      }
    };
  };

  static _reframe(offset: number, bits: number): (value: Uint8Array) => Uint8Array {
    return (v) => {
      const required_size = Math.ceil(bits / 8);
      const result = new Uint8Array(required_size);

      for (let i = 0; i < required_size; i++) {
        result[i] = v[i+offset];
      }
      return result;

    };
  }

  static strlen(buff: Uint8Array): number {
    for (let i = 0; i < buff.length; i++) if (buff[i] == 0) return i;
    return buff.length;
  }
}

type Uint8ArrayPosition = { byte: number, bit: number };
export const Uint8Array_pos = (count: number): Uint8ArrayPosition => ({
  byte: Math.floor(count / 8),
  bit: count % 8
});

export function Uint8Array_bit_at(v: Uint8Array, pos: Uint8ArrayPosition, endianness: Endianness = Endianness.LITTLE): number {
  let byte: number = 0;
  switch(endianness) {
    case Endianness.LITTLE: byte = v[pos.byte]; break;
    case Endianness.BIG: byte = v[v.length - 1 - pos.byte]; break;
  }
  return (byte >> pos.bit) & 1;
}























// type t = { name: string, type: `struct`, description: [
//   { name: string, type: `int`, bytes: 4 },
//   { name: string, type: `double`, bytes: 8 },
//   { name: string, type: `array`, value_description: { name: string, type: `float`, bytes: 4}, size: 2 },
//   { name: string, type: `float`, bytes: 4 },
//   { name: string, type: `byte`, bytes: 1 },
//   { name: string, type: `string` },
//   { name: string, type: `array`, value_description: {
//     name: string, type: `struct`,  description: [{ name: string, type: `bool`, bits: 1 }]
//   }, size: 15 }
// ] };
// type z = DescriptedType<t>//["d"]// extends Array<infer T> ? T : never;


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
  //        case `double`: {
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
