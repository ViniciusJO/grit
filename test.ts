// deno-lint-ignore-file no-explicit-any
import { Bytes, type TypeAsString } from "./src/index.ts";

const CLOSE_ENOUGH_FLOAT = 9E-6;

const sample = [
  [ false, `bool`, [ 0 ] ],
  [ true, `bool`, [ 1 ] ],
  [ "abc", `string`, [ 97, 98, 99 ] ],
  [ "", `string`, [ ] ],
  [ 100, `byte`, [ 100 ] ],
  [ 0, `byte`, [ 0 ] ],
  [ -100, `int`, [ 156, 255, 255, 255 ] ],
  [ 5.5, `float`, [ 0, 0, 176, 64  ] ],
  [ -7.9, `float`, [ 205, 204, 252, 192 ] ],
  [ -15.0, `int`, [ 241, 255, 255, 255 ] ],
  [
    `testing long strings   to see   if it WORKS!   `,
    `string`,
    [ 116,101,115,116,105,110,103,32,108,111,110,103,32,115,116,114,105,110,103,115,32,32,32,116,111,32,115,101,101,32,32,32,105,102,32,105,116,32,87,79,82,75,83,33,32,32,32 ]
  ],
  [ 2147483647, `int`, [ 255, 255, 255, 127 ] ],
]

sample.forEach(el => {
  const converted_type = convert_typeof(typeof el[0] as any, el[0] as any);
  const res = [...Bytes.from(converted_type)(el[0] as any)];
  const contra_res = Bytes.to(converted_type)(new Uint8Array(res));
  console.log(`<${converted_type}> ${el[0]} ==>`, res, `=>>`, contra_res)
  assert(converted_type, el[1], `${converted_type} != ${el[1]}`);
  assert(res, el[2], `${res} != ${el[2]}`);
  assert(contra_res, el[0], `${contra_res} != ${el[0]}`);
});

{
  console.log(`\n\n1.DOUBLE_SITUATION: \n`);
  const a = -73.99;
  const b = [...Bytes.from(`float`)(a)];
  const c = Bytes.to(`float`)(new Uint8Array(b));
  assert(a, c, `${a} != ${c}`)
}

{
  console.log(`\n\n2.DOUBLE_SITUATION: \n`);
  const a = -73.9999999;
  const b = [...Bytes.from(`float`)(a)];
  const c = Bytes.to(`float`)(new Uint8Array(b));
  assert(a, c, `${a} != ${c}`)
}

{
  console.log(`\n\n3.DOUBLE_SITUATION: \n`);
  const a = -73.0000001;
  const b = [...Bytes.from(`float`)(a)];
  const c = Bytes.to(`float`)(new Uint8Array(b));
  assert(a, c, `${a} != ${c}`)
}





// TODO: fix comparation
function areNearlyEqual(a: number, b: number): boolean {
  const a_str = a.toString();
  const b_str = b.toString();
  let decimals = 0;
  let found_decimal = false;
  for(const l of ((a_str.length < b_str.length) ? a_str : b_str)) {
    if(l == '.') found_decimal = true;
    if(found_decimal) {
      decimals++;
    }
  }


  const new_a = Math.trunc(a * Math.pow(10, decimals+2));
  const new_b = Math.trunc(b * Math.pow(10, decimals+2));

  const diff = Math.abs(new_a - new_b);

  console.log(`A: ${a} -> ${new_a}\nB: ${b} -> ${new_b}\nDECS: ${decimals}\nDIFF: ${diff}`);

  return diff <= 1
}

function assert<T>(a: T, b: T, msg = ""): void {
  // const is_float = <T>(e: T): boolean => convert_typeof(typeof e, e) == `float` || convert_typeof(typeof e, e) == `double`; 
  const err_msg = `ASSERT_ERROR: ${msg}`;
  if(Array.isArray(a) && Array.isArray(b)) {
    if(a.length != b.length) throw err_msg;
    for(let i = 0; i < a.length; i++)
      if(a[i] != b[i]) throw err_msg;
  } else if(typeof a == `number` && typeof b == `number`) {
    if(!areNearlyEqual(a as number, b as number)) throw err_msg;
  } else if(a != b) throw err_msg;
}

function convert_typeof(type: string, value: any): TypeAsString {
  switch(type) {
    case `boolean`: {
      return `bool`
    }
    case `number`: {
      for(const l of String(value)) {
        if(l == '.') return `float`;
      }
      if(value >= 0 && value <= 255) return `byte`;
      return `int`;
    }
    default: return type as TypeAsString;
  }
}

