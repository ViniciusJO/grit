# Grit - bit grinder

A set of runtime-agnostic tools to deal with binary encoding and decoding in TypeScript.

This library allows manual handling of bytes or to declarativelly write binary layouts descriptions that automatically:

* Encodes JavaScript objects → `Uint8Array`
* Decodes `Uint8Array` → strongly‑typed objects
* Works at bit‑level or byte‑level precision
* Allows configuration of in/out endianness
* Shares the same codebase across Bun, Deno and Node.js

No runtime‑specific APIs are required beyond standard Web/JS primitives.

<!-- --- -->

<!-- ## Features -->
<!---->
<!-- * Runtime‑agnostic (Deno / Node / Bun) -->
<!-- * Big or Little endian in/out buffers -->
<!-- * Bit‑accurate binary slicing -->
<!-- * Declarative binary schemas -->
<!-- * Recursive structs and arrays -->
<!-- * Strong TypeScript inference -->
<!-- * Zero dependencies -->

---

## Installation

As a source‑first library, just copy the `Bytes.ts` file to your project folder and then import:

```ts
import { Bytes } from "./Bytes.ts";
```
---

## Core Concepts

### Endianness

All the functions that deal with multiple bytes defaults its input and output endianess to little endian, but are configurable by arguments of type:

```typescript
type Endianness = "LITTLE" | "BIG";
```

### Type Strings

For use in this libary, binary types are represented as string literals:

```ts
type TypeAsString =
    | "bool"
    | "byte"
    | "int"
    | "float"
    | "double"
    | "string"
    | "array"
    | "struct";
```

They map to concrete TypeScript types:

| Binary Type | JS Type            |
| ----------- | ------------------ |
| `bool`      | `boolean`          |
| `byte`      | `number` (0–255)   |
| `int`       | `number` (int32)   |
| `float`     | `number` (float32) |
| `double`    | `number` (float64) |
| `string`    | `string`           |
| `array`     | `Array<T>`         |
| `struct`    | `object`           |

---

## Bytes Utility

Byte <-> value conversion helpers.

### `Bytes.from`

Signature:

```ts
<T extends PrimitiveAsString>(
    type: T,
    out_endianness: Endianness = `LITTLE`
) => (value: PrimitiveTypeReference[T]) => Uint8Array
```

Encodes a value into a `Uint8Array`.

```ts
const encodeInt = Bytes.from("int");
const buf = encodeInt(123);
```

Supported types:

```typescript
type PrimitiveAsString =
    | "bool"
	| "byte"
	| "int"
	| "float"
	| "double"
	| "string";
```

---

### `Bytes.to`

Signature: 

```ts
<T extends PrimitiveAsString>(
    type: T,
    in_endianness: Endianness = `LITTLE`
) => (value: Uint8Array) => PrimitiveTypeReference[T] | void
```

Decodes a `Uint8Array` into a JS value.

```ts

const decodeInt = Bytes.to("int");
const value = decodeInt(buf);
```

---

### `Bytes.padding`

Signature:

```typescript
(
    size: number,
    in_endianness: Endianness = `LITTLE`,
    out_endianness: Endianness = `LITTLE`
) => (value: Uint8Array) => Uint8Array
```

Pads a `Uint8Array` to a fixed size.

```ts
const pad8 = Bytes.padding(8);
const padded = pad8(new Uint8Array([1, 2]));
```

---

### `Bytes.toBase64`

Signature:

```typescript
(value: Uint8Array) => string
```

Encodes binary data to Base64.

```ts
const b64 = Bytes.toBase64(buf);
```

---

## Bit & Byte Manipulation

### `Bytes.reframe`

Signature:

```typescript
(
    offset: number,
    bits: number,
    in_endianness: Endianness = `LITTLE`,
    out_endianness: Endianness = `LITTLE`
) => (value: Uint8Array) => Uint8Array
```

Extracts a bit‑range from a `Uint8Array`.

```ts
const slice = Bytes.reframe(3, 5)(buffer);
```

* `offset` → starting bit
* `bits` → number of bits to extract

Result is right‑aligned and byte‑packed.

---

### `Bytes.strlen`

Signature:

```typescript
(buff: Uint8Array) => number
```

C‑style string length detection (null‑terminated).

```ts
const len = Bytes.strlen(buffer);
```

---

## Declarative Binary Descriptions

### `DecodeField`

A description of a single binary field.

```ts
type DecodeDescription = {
  name: string;
} & (
  | { type: "bool"; bits?: number; bytes?: number }
  | { type: "byte" | "int" | "float" | "double"; bits?: number; bytes?: number }
  | { type: "string"; bytes?: number }
  | { type: "array"; value_description: DecodeDescription; size: number }
  | { type: "struct"; description: DecodeDescription[] }
);
```

Example description:

```ts
const Packet = {
  name: "packet",
  type: "struct",
  description: [
    { name: "id", type: "int", bytes: 4 },
    { name: "temperature", type: "float", bytes: 4 },
    { name: "valid", type: "bool", bits: 1 },
  ],
} as const;
```

---

### Type Inference

#### `DescribedType<T extends DecodeDescription>`

Automatically infers the **runtime object type** from a binary description.

```ts
type PacketType = DescribedType<typeof Packet>;
// {
//   id: number;
//   temperature: number;
//   valid: boolean;
// }
```

---

### Size Calculation

#### `Bytes.size_in_memory`

Signature:

```typescript
(d: DecodeDescription, value?: Uint8Array) => number
```

Computes the minimum required size in bytes.

```ts
const size = Bytes.size_in_memory(Packet);
```

Works recursively for arrays and structs.

---

### Encoding

#### `Bytes.encoder`

Signature:

```typescript
<T extends DecodeDescription>(
    desc: T,
    out_endianness: Endianness = `LITTLE`
) => (value: DescribedType<T>) => Uint8Array
```

Returns a function that encodes structured data into binary.

```ts
const encode = Bytes.encoder(Packet);
const buf = encode({ id: 1, temperature: 36.5, valid: true });
```

---

### Decoding

#### `Bytes.decoder`

Signature:

```typescript
<T extends DecodeDescription>(
    desc: T,
    in_endianness: Endianness = `LITTLE`
) => (value: Uint8Array) => DescribedType<T>
```

Returns a function that decodes binary data into structured objects.

```ts
const decode = Bytes.decoder(Packet);
const value = decode(buf);
```

---

### Nested Structures

Arrays and structs can be nested arbitrarily.

```ts
const Shape = {
  name: "shape",
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
} as const;
```

---

### Tested Runtime Compatibility

- [x] Bun
- [x] Deno
- [x] Node

Relies only on:

* `Uint8Array`
* `ArrayBuffer`
* `DataView`
* `TextEncoder` / `TextDecoder`

## TODO

- [ ] better methods explanations
- [ ] encoding/decoding not byte aligned structures
