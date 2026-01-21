const esc_red = `\x1b[31m`;
const esc_green = `\x1b[32m`;
const esc_blue = `\x1b[34m`;
const esc_reset = `\x1b[0m`;

type TestFn = () => void | Promise<void>;
type TestObject = { name: string; fn: TestFn };
export type TestArray = Array<TestObject>;

const tests: TestArray = [];

export function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

export function assert(cond: unknown, msg = "Assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}

export function assert_equals(a: unknown, b: unknown, msg?: string) {
  const ok =
    typeof a === "number" && typeof b === "number"
      ? Object.is(a, b)
      : JSON.stringify(a) === JSON.stringify(b);

  if (!ok) {
    throw new Error(
      msg ??
        `Assertion failed:\n- expected: ${esc_green}${JSON.stringify(b)}${esc_reset}\n- received: ${esc_red}${JSON.stringify(a)}${esc_reset}`
    );
  }
}

export async function run_tests(): Promise<void> {
  const failed: Array<string> = [];

  console.log(`\n${esc_blue}[ Test Runner ]${esc_reset}\n ${name}`);

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`${esc_green}✓${esc_reset} ${name}`);
    } catch (e) {
      failed.push(name);
      console.error(`${esc_red}✗${esc_reset} ${name}`);
      console.error(e);
    }
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} test(s) failed\n`);
    for(const f of failed) {
      console.error(`- ${esc_red}"${f}"${esc_reset} failed`);
    }
    console.log("");
    throw "TestFailed";
  }
  else console.log(`\nAll ${tests.length} tests passed`);
}
