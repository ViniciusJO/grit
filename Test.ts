// deno-lint-ignore-file no-explicit-any

const esc_red = `\x1b[31m`;
const esc_green = `\x1b[32m`;
const esc_blue = `\x1b[34m`;
const esc_yellow = `\x1b[35m`;
const esc_reset = `\x1b[0m`;

/**
 * Signature of the test function passed to the `test` funciton
 */
export type TestFn = () => void | Promise<void>;
type TestObject = { name: string; test_fn: TestFn };
type TestGroupObject = { name: string; group: TestGroup };
export type TestGroup = Array<TestObject | TestGroupObject>;

function is_test_group(o: unknown): o is TestGroupObject { return `group` in (o as any); }
function is_test_array(o: unknown): o is TestGroup { return Array.isArray(o); }


const internal_tests: TestGroup = [];

/**
 * Register `test_entry` function or group in the test system associated with the `name`.
 * If test `group` is not provided, it will use the default global one.
 */
export function test(name: string, test_entry: TestFn | TestGroup, group = internal_tests) {
  if(is_test_array(test_entry)) {
    group.push({ name, group: test_entry });
  } else {
    group.push({ name, test_fn: test_entry });
  }
}

/**
 * Runs registered tests.
 * If test `group` is not provided, the default global one will be used.
 * `padding` is meant to be used internally to properly align nested groups reports.
 */
export async function run_tests(group: TestGroup = internal_tests, padding = 0): Promise<[string[], number]> {
  let test_count = 0;
  let failed: Array<string> = [];

  if(!padding) console.log(`\n${esc_blue}[ Test Runner ]${esc_reset}\n`);

  for (const el of group) {
    if(is_test_group(el)) {
      const { name, group } = el;
      const _pfx = `\b\b- ${padding > 0 ? `  ` : ``}`;
      console.log(`${_pfx}${esc_yellow}v ${name}${esc_reset}`);
      reset_console_padding();
      // console.group(name);
      pad_console((padding + 1) * 4);
        let f: string[] = [];
        let count = 0;
        try { [f, count] = await run_tests(group, padding + 1); } catch(e) { e; }
      reset_console_padding();
      // console.groupEnd();
      pad_console((padding) * 4);
      console.log(`${_pfx}${esc_yellow}^ ${name}${esc_reset}`);
      reset_console_padding();
      failed = [ ...failed, ...f.map(el => `${name} -> ${el}`) ];
      test_count += count;
    } else {
      const { name, test_fn } = el;
      const old_cl = console.log, old_ce = console.error, old_cw = console.warn;
      type LogType = `LOG` | `ERROR` | `WARN`;
      let log_stream: Array<{ type: LogType, data: any[] }> = [];
      console.log = (...data: any[]): void => { log_stream = [ ...log_stream, { type: `LOG`, data } ] };
      console.error = (...data: any[]): void => { log_stream = [ ...log_stream, { type: `ERROR`, data } ] };
      console.warn = (...data: any[]): void => { log_stream = [ ...log_stream, { type: `WARN`, data } ] };
      try {
        await test_fn();
        old_cl(`\b\b- ${esc_green}✓${esc_reset} ${name}`);
      } catch (e) {
        failed.push(name);
        old_ce(`\b\b- ${esc_red}✗${esc_reset} ${name}`);
        old_ce(e);
      }
      console.log = old_cl; console.error = old_ce; console.warn = old_cw;
      for(const l of log_stream) {
        switch(l.type) {
          case `LOG`: console.log(...l.data); break;
          case `ERROR`: console.error(...l.data); break;
          case `WARN`: console.warn(...l.data); break;
        }
      }
      test_count++;
    }
  }

  b: if (failed.length > 0) {
    if(padding) break b;
    console.error(`\n${failed.length}/${test_count} test(s) failed\n`);
    for(const f of failed) {
      console.error(`- ${esc_red}${f}${esc_reset} failed`);
    }
    console.log(``);
    if(padding == 0) throw `TestFailed`;
  }
  else console.log(`\nAll ${internal_tests.length} tests passed`);
  return [failed, test_count];
}


//
// Assertion functionality
//


/**
 * Asserts the condition helping controll flow analysis and type narrowing
 * If `cond` is falsy throws error with `msg`
 */
export function assert(cond: unknown, msg = ``): asserts cond {
  if (!cond) throw `- Assertion failed${msg ? `: ${msg}` : ``}`;
}

/**
 * Asserts `a` equals `b`
 * Do not act on controll flow analysis
 * In case `a != b` throws an error with `msg`
 */
export function assert_equals(a: unknown, b: unknown, msg?: string) {
  const ok =
    typeof a === `number` && typeof b === `number`
      ? Object.is(a, b)
      : JSON.stringify(a) === JSON.stringify(b);

  if (!ok) {
    throw `- Assertion failed: ${msg ??
      `\n  > expected: ${esc_green}${JSON.stringify(b)}${esc_reset}\n  < received: ${esc_red}${JSON.stringify(a)}${esc_reset}`}`
  }
}


//
// Custom log functionality
//


let originalConsoleLog: typeof console.log | null = null;
let originalConsoleError: typeof console.error | null = null;
let originalConsoleWarn: typeof console.warn | null = null;

function pad_console(prefix: string | number = `  `) {

  const pad =
    typeof prefix === `number`
      ? `  |  `.repeat(prefix/4)
      : `|` + prefix;

  if(null == originalConsoleLog) {
    originalConsoleLog = console.log;
    console.log = (...args: unknown[]) => {
      const text = args
        .map(a => typeof a === `string` ? a : String(a))
        .join(` `);

      const padded = text
        .split(`\n`)
        .map(line => pad + line)
        .join(`\n`);

      originalConsoleLog!(padded);
    };
  }

  if(null == originalConsoleError) {
    originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const text = args
      .map(a => typeof a === `string` ? a : String(a))
      .join(` `);

      const padded = text
      .split(`\n`)
      .map(line => pad + line)
      .join(`\n`);

      originalConsoleError!(padded);
    };
  }

  if(null == originalConsoleWarn) {
    originalConsoleWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      const text = args
      .map(a => typeof a === `string` ? a : String(a))
      .join(` `);

      const padded = text
      .split(`\n`)
      .map(line => pad + line)
      .join(`\n`);

      originalConsoleWarn!(padded);
    };
  }
}

function reset_console_padding() {
  if (originalConsoleLog) {
    console.log = originalConsoleLog;
    originalConsoleLog = null;
  }
  if (originalConsoleError) {
    console.error = originalConsoleError;
    originalConsoleError = null;
  }
  if (originalConsoleWarn) {
    console.warn = originalConsoleWarn;
    originalConsoleWarn = null;
  }
}

