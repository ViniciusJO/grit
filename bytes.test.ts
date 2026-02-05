// deno-lint-ignore-file no-explicit-any

import {
  Bytes,
  type DecodeDescription,
  type DescribedType,
} from "./Bytes.ts";

import { assert, assert_equals, run_tests, test  } from "./Test.ts";

/* =========================================================
 * Bytes.from / Bytes.to
 * ========================================================= */

test("bool encode/decode", () => {
  const v = Bytes.from("bool")(true);
  assert_equals(v, new Uint8Array([1]));
  assert_equals(Bytes.to("bool")(v), true);
});

test("byte encode/decode", () => {
  const v = Bytes.from("byte")(255);
  assert_equals(v, new Uint8Array([255]));
  assert_equals(Bytes.to("byte")(v), 255);
});

test("int encode/decode", () => {
  const x = 0x12345678 | 0;
  const v = Bytes.from("int")(x);
  assert_equals(Bytes.to("int")(v), x);
});

test("float encode/decode", () => {
  const x = Math.PI;
  const v = Bytes.from("float")(x);
  const y = Bytes.to("float")(v)!;
  assert(Math.abs(x - y) < 1e-6);
});

test("double encode/decode", () => {
  const x = Math.PI;
  const v = Bytes.from("double")(x);
  const y = Bytes.to("double")(v)!;
  assert(Math.abs(x - y) < 1e-12);
});

test("string encode/decode", () => {
  const s = "hello world";
  const v = Bytes.from("string")(s);
  assert_equals(Bytes.to("string")(v), s);
});

/* =========================================================
 * Bytes.strlen
 * ========================================================= */

test("strlen stops at null terminator", () => {
  assert_equals(Bytes.strlen(new Uint8Array([65, 66, 67, 0, 88])), 3);
});

test("strlen full buffer", () => {
  assert_equals(Bytes.strlen(new Uint8Array([1, 2, 3])), 3);
});

/* =========================================================
 * Bytes.reframe / Bytes._reframe
 * ========================================================= */

test("reframe extracts bits", () => {
  const v = new Uint8Array([0b10101010, 0b11001100]);
  let r: Uint8Array;

  // [0b10101010, 0b11001100] Little => 0b1100110010101010
  // reframed: 0b | [11001100] | 10101010
  r = Bytes.reframe(8, 8)(v);
  assert_equals(r[0], 0b11001100);
  // reframed: 0b11001100 | [ 1010 ] | 1010
  r = Bytes.reframe(4,4)(v);
	assert_equals(r[0], 0b00001010);
  // reframed: 0b1100110 | [ 01010 ] | 1010
  r = Bytes.reframe(4,5)(v);
	assert_equals(r[0], 0b00001010);
  // reframed: 0b110011 | [ 001010 ] | 1010
  r = Bytes.reframe(4,6)(v);
	assert_equals(r[0], 0b00001010);
  // reframed: 0b11001 | [ 1001010 ] | 1010
  r = Bytes.reframe(4,7)(v);
	assert_equals(r[0], 0b01001010);

  // [0b10101010, 0b11001100] Little => 0b1100110010101010
  // reframed: 0b110 | [01] [10010101] | 010
  // out Little: [0b10010101, 0b00000001]
  r = Bytes.reframe(3, 10)(v);
  assert_equals(r[0], 0b10010101);
  assert_equals(r[1], 0b00000001);

  // [0b10101010, 0b11001100] Big => 0b1010101011001100
  // reframed: 0b101 | [01] [01011001] | 100
  // out Little: [0b01011001, 0b00000001]
  r = Bytes.reframe(3, 10, `BIG`)(v);
  assert_equals(r[0], 0b01011001);
  assert_equals(r[1], 0b00000001);

  // [0b10101010, 0b11001100] Big => 0b1010101011001100
  // reframed: 0b101 | [01] [01011001] | 100
  // out BIG: [0b00000001, 0b01011001]
  r = Bytes.reframe(3, 10, `BIG`, `BIG`)(v);
  assert_equals(r[0], 0b00000001);
  assert_equals(r[1], 0b01011001);
});

// TODO: fix _reframe
// test("_reframe extracts bytes", () => {
//   const v = new Uint8Array([10, 20, 30, 40]);
//   const r = Bytes._reframe(1, 2)(v);
//   assert_equals(r, new Uint8Array([20, 30]));
// });

/* =========================================================
 * Bytes.size_in_memory
 * ========================================================= */

test("min_Bytes.size_in_memory primitives", () => {
  assert_equals(Bytes.size_in_memory({ name: "a", type: "bool", bits: 1 }), 1);
  assert_equals(Bytes.size_in_memory({ name: "b", type: "byte", bytes: 1 }), 1);
  assert_equals(Bytes.size_in_memory({ name: "c", type: "int", bytes: 4 }), 4);
  assert_equals(Bytes.size_in_memory({ name: "d", type: "double", bytes: 8 }), 8);
});

test("min_Bytes.size_in_memory array", () => {
  const d: DecodeDescription = {
    name: "arr",
    type: "array",
    size: 4,
    value_description: { name: "x", type: "byte", bytes: 1 },
  };
  assert_equals(Bytes.size_in_memory(d), 4);
});

test("min_Bytes.size_in_memory struct", () => {
  const d: DecodeDescription = {
    name: "s",
    type: "struct",
    description: [
      { name: "a", type: "byte", bytes: 1 },
      { name: "b", type: "int", bytes: 4 },
    ],
  };
  assert_equals(Bytes.size_in_memory(d), 5);
});

/* =========================================================
 * Bytes.encoder / Bytes.decoder
 * ========================================================= */

test("encode/decode primitive", () => {
  const desc: DecodeDescription = { name: "x", type: "int", bytes: 4 };
  const buf = Bytes.encoder(desc)(123456 as any);
  const out = Bytes.decoder(desc)(buf);
  assert_equals(out, 123456);
});

test("encode/decode array", () => {
  const desc: DecodeDescription = {
    name: "arr",
    type: "array",
    size: 3,
    value_description: { name: "x", type: "byte", bytes: 1 },
  };
  const value = [1, 2, 3];
  const buf = Bytes.encoder(desc)(value as any);
  const out = Bytes.decoder(desc)(buf);
  assert_equals(out, value);
});

test("encode/decode struct", () => {
  const desc = {
    name: "root",
    type: "struct",
    description: [
      { name: "a", type: "byte", bytes: 1 },
      { name: "b", type: "int", bytes: 4 },
      { name: "c", type: "bool", bits: 1 },
    ],
  } as const;

  // @ts-ignore infinite recursion
  type T = DescribedType<typeof desc>;

  const value: T = { a: 10, b: 42, c: true };
  // @ts-ignore infinite recursion
  const buf = Bytes.encoder(desc)(value);
  // @ts-ignore infinite recursion
  const out = Bytes.decoder(desc)(buf);

  // console.log(`\n`, Bytes.encoder({ name: "", type: "string" })("01234"), `\n`);

  assert_equals(out, value);
});

test("encode/decode nested struct + array", () => {
  const desc: DecodeDescription = {
    name: "root",
    type: "struct",
    description: [
      {
        name: "points",
        type: "array",
        size: 2,
        value_description: {
          name: "p",
          type: "struct",
          description: [
            { name: "x", type: "float", bytes: 4 },
            { name: "y", type: "float", bytes: 4 },
          ],
        },
      },
    ],
  };

  const value = {
    points: [
      { x: 1.5, y: 2.5 },
      { x: 3.5, y: 4.5 },
    ],
  };

  const buf = Bytes.encoder(desc)(value as any);
  const out = Bytes.decoder(desc)(buf);

  assert_equals(out, value);
});

run_tests();

