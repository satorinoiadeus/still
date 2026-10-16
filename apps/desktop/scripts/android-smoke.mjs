// Developer test: a local Android emulator, never a user's phone.
// Usage: ANDROID_HOME=... node scripts/android-smoke.mjs /absolute/path/to/test.apk
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, open, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
const run = promisify(execFile),
    sdk = process.env.ANDROID_HOME,
    apk = process.argv[2];
if (!sdk || !apk) throw Error("ANDROID_HOME and APK path required");
const adb = async (...args) =>
    (
        await run(`${sdk}/platform-tools/adb`, args, {
            timeout: 45000,
            maxBuffer: 8000000,
        })
    ).stdout.trim();
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
await adb("start-server");
const testDir = join(tmpdir(), "still-android-smoke");
await mkdir(testDir, { recursive: true });
const out = await open(join(testDir, "emulator-test.log"), "w");
const emulator = spawn(
    `${sdk}/emulator/emulator`,
    [
        "-avd",
        "still-test",
        "-no-window",
        "-no-audio",
        "-no-boot-anim",
        "-no-snapshot",
        "-read-only",
        "-gpu",
        "swiftshader_indirect",
        "-accel",
        "off",
        "-memory",
        "1536",
    ],
    { stdio: ["ignore", out.fd, out.fd] },
);
let ws;
try {
    let booted = false;
    const bootDeadline = Date.now() + 300000;
    for (let i = 0; i < 100; i++) {
        if (Date.now() > bootDeadline)
            throw Error("Emulator boot exceeded five-minute limit");
        if (emulator.exitCode !== null)
            throw Error("Emulator exited: " + emulator.exitCode);
        if (i % 10 === 0) console.log(await adb("devices"));
        try {
            if ((await adb("shell", "getprop", "sys.boot_completed")) === "1") {
                booted = true;
                break;
            }
        } catch {}
        if (i % 10 === 0) console.log("Waiting for Android emulator boot…");
        await delay(3000);
    }
    assert.ok(booted, "Emulator booted");
    await adb("shell", "input", "keyevent", "82");
    // Wait for package manager and avoid streamed-install transport on software emulators.
    for (let i = 0; i < 20; i++) {
        try {
            if (
                (await adb("shell", "pm", "path", "android")).includes(
                    "package:",
                )
            )
                break;
        } catch {}
        await delay(1500);
    }
    try {
        console.log(await adb("install", "--no-streaming", "-r", apk));
    } catch {
        await delay(5000);
        console.log(await adb("install", "--no-streaming", "-r", apk));
    }
    await adb("shell", "am", "start", "-n", "app.still.tasks/.MainActivity");
    let counter = 0;
    const pending = new Map();
    async function attach() {
        const pid = await adb("shell", "pidof", "app.still.tasks");
        assert.ok(pid, "App process exists");
        await adb(
            "forward",
            "tcp:9222",
            `localabstract:webview_devtools_remote_${pid}`,
        );
        let targets;
        for (let i = 0; i < 40; i++) {
            try {
                targets = await (
                    await fetch("http://127.0.0.1:9222/json/list")
                ).json();
                if (targets.length) break;
            } catch {}
            await delay(1000);
        }
        assert.ok(targets?.[0]?.webSocketDebuggerUrl, "Debuggable app WebView");
        ws = new WebSocket(targets[0].webSocketDebuggerUrl);
        await new Promise((res, rej) => {
            ws.onopen = res;
            ws.onerror = rej;
        });
        ws.onmessage = (e) => {
            const d = JSON.parse(e.data);
            if (d.id && pending.has(d.id)) {
                pending.get(d.id)(d);
                pending.delete(d.id);
            }
        };
    }
    async function cdp(method, params = {}) {
        const id = ++counter;
        return new Promise((res, rej) => {
            const t = setTimeout(
                () => rej(Error(`CDP timeout: ${method}`)),
                15000,
            );
            pending.set(id, (d) => {
                clearTimeout(t);
                d.error ? rej(Error(JSON.stringify(d.error))) : res(d.result);
            });
            ws.send(JSON.stringify({ id, method, params }));
        });
    }
    async function evaluate(expression) {
        const d = await cdp("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise: true,
        });
        if (d.exceptionDetails) throw Error(JSON.stringify(d.exceptionDetails));
        return d.result.value;
    }
    async function waitFor(expression) {
        for (let i = 0; i < 40; i++) {
            if (await evaluate(expression)) return;
            await delay(500);
        }
        throw Error(
            "UI condition failed: " +
                expression +
                "\n" +
                (await evaluate("document.body.innerText")),
        );
    }
    async function click(text) {
        await evaluate(
            `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)}));if(!b)throw Error('Button not found');b.click()})()`,
        );
        await delay(350);
    }
    await attach();
    await waitFor(
        'document.body.innerText.includes("Explore a sample workspace")',
    );
    assert.equal(await evaluate("'__TAURI_INTERNALS__' in window"), true);
    assert.ok((await evaluate("document.body.innerText")).includes("SQLite"));
    await click("Explore a sample workspace");
    await waitFor('document.body.innerText.includes("Ask one lawyer")');
    await evaluate('document.querySelector(".add-inline").click()');
    await delay(300);
    await evaluate(
        `(()=>{const el=document.querySelector('input[required]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Native persistence test');el.dispatchEvent(new Event('input',{bubbles:true}))})()`,
    );
    await delay(300);
    await evaluate(
        'document.querySelector("[role=dialog] form").requestSubmit()',
    );
    await waitFor(
        'document.body.innerText.includes("Native persistence test") && !document.querySelector("[role=dialog]")',
    );
    console.log(
        "Native UI: startup, SQLite, sample workspace and task creation passed.",
    );
    ws.close();
    await adb("shell", "am", "force-stop", "app.still.tasks");
    await adb("shell", "am", "start", "-n", "app.still.tasks/.MainActivity");
    await delay(1500);
    await attach();
    await waitFor(
        'document.body.innerText.includes("Native persistence test")',
    );
    await evaluate(
        "document.querySelector('[aria-label=\"Complete Native persistence test\"]').click()",
    );
    await delay(400);
    await evaluate(
        "document.querySelector('[aria-label=\"Open navigation\"]').click()",
    );
    await delay(300);
    await click("Logbook");
    await waitFor(
        'document.body.innerText.includes("Native persistence test")',
    );
    console.log(
        "Native persistence after force-stop/restart and task completion passed.",
    );
    const files = await adb(
        "shell",
        "run-as",
        "app.still.tasks",
        "find",
        ".",
        "-name",
        "still.db",
    );
    assert.ok(files.includes("still.db"));
    const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
    await writeFile(
        join(testDir, "android-tested.png"),
        Buffer.from(screenshot.data, "base64"),
    );
    console.log("Android smoke test PASSED. SQLite file:", files);
} finally {
    ws?.close();
    try {
        await adb("emu", "kill");
    } catch {}
    emulator.kill("SIGTERM");
    await out.close();
}
