# Grit - bit grinder

A set of tools to deal with binary encoded data in typescript.



# IA Docs

## Binary Decode Utilities (TypeScript)

A **runtime‑agnostic binary encoding/decoding toolkit** written in TypeScript.

This library allows you to **describe binary layouts declaratively** and then automatically:

* Encode JavaScript objects → `Uint8Array`
* Decode `Uint8Array` → strongly‑typed objects
* Work at **bit‑level or byte‑level precision**
* Share the same codebase across **Deno, Node.js, and Bun**

No runtime‑specific APIs are required beyond standard Web/JS primitives.

---

### Features

* ✅ Runtime‑agnostic (Deno / Node / Bun)
* ✅ Bit‑accurate binary slicing
* ✅ Declarative binary schemas
* ✅ Recursive structs and arrays
* ✅ Strong TypeScript inference
* ✅ Zero dependencies

---

### Installation

This is a source‑first library. Copy or vendor the file directly, or install via your preferred workflow.

```ts
import {
  Bytes,
} from "./bytes.ts";
```

---

### Core Concepts

#### Type Strings

Primitive binary types are represented as string literals:

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

### Bytes Utility

Low‑level byte ↔ value conversion helpers.

#### `Bytes.from(type)`

Encodes a value into a `Uint8Array`.

```ts
const encodeInt = Bytes.from("int");
const buf = encodeInt(123);
```

Supported types:

* `bool`
* `byte`
* `int`
* `float`
* `double`
* `string`

---

#### `Bytes.to(type)`

Decodes a `Uint8Array` into a JS value.

```ts
const decodeInt = Bytes.to("int");
const value = decodeInt(buf);
```

---

#### `Bytes.padding(size)`

Pads a `Uint8Array` to a fixed size.

```ts
const pad8 = Bytes.padding(8);
const padded = pad8(new Uint8Array([1, 2]));
```

---

#### `Bytes.toBase64(value)`

Encodes binary data to Base64.

```ts
const b64 = Bytes.toBase64(buf);
```

---

### Bit & Byte Manipulation

#### `Bytes.reframe(offset, bits)`

Extracts a bit‑range from a `Uint8Array`.

```ts
const slice = Bytes.reframe(3, 5)(buffer);
```

* `offset` → starting bit
* `bits` → number of bits to extract

Result is right‑aligned and byte‑packed.

---

#### `Bytes._reframe(offset, bytes)`

Extracts raw bytes from a buffer.

```ts
const chunk = Bytes._reframe(2, 4)(buffer);
```

---

#### `Bytes.strlen(buffer)`

C‑style string length detection (null‑terminated).

```ts
const len = Bytes.strlen(buffer);
```

---

### Declarative Binary Descriptions

#### `DecodeField`

A description of a single binary field.

```ts
type DecodeField = {
  name: string;
} & (
  | { type: "bool"; bits?: number; bytes?: number }
  | { type: "byte" | "int" | "float" | "double"; bits?: number; bytes?: number }
  | { type: "string"; bytes?: number }
  | { type: "array"; value_description: DecodeField; size: number }
  | { type: "struct"; description: DecodeField[] }
);
```

---

#### Example Description

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

#### `DescribedType<T>`

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

#### `Bytes.size_in_memory(description)`

Computes the minimum required size in bytes.

```ts
const size = Bytes.size_in_memory(Packet);
```

Works recursively for arrays and structs.

---

### Encoding

#### `Bytes.encoder(description)`

Returns a function that encodes structured data into binary.

```ts
const encode = Bytes.encoder(Packet);
const buf = encode({ id: 1, temperature: 36.5, valid: true });
```

---

### Decoding

#### `Bytes.decoder(description)`

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

### Runtime Compatibility

| Runtime | Supported |
| ------- | --------- |
| Deno    | ✅         |
| Node    | ✅         |
| Bun     | ✅         |

Relies only on:

* `Uint8Array`
* `ArrayBuffer`
* `DataView`
* `TextEncoder` / `TextDecoder`

---

### Philosophy

This library is designed for:

* Binary protocols
* Embedded / telemetry data
* Reverse‑engineering
* Custom network formats
* Systems programming in TypeScript

The focus is **correctness, transparency, and type safety**, not magic.

---

### License

MIT

