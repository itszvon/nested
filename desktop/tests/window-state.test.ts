import test from "node:test";
import assert from "node:assert/strict";
import { clampBounds, MIN_HEIGHT, MIN_WIDTH } from "../src/window-state.ts";

const primary = { x: 0, y: 0, width: 1920, height: 1080 };
const fallback = { width: 1280, height: 820 };

test("no saved state falls back to the default size", () => {
  assert.deepEqual(clampBounds(null, [primary], fallback), fallback);
});

test("a visible position is restored", () => {
  const saved = { x: 100, y: 120, width: 1400, height: 900 };
  assert.deepEqual(clampBounds(saved, [primary], fallback), saved);
});

test("an off-screen position is discarded", () => {
  const saved = { x: 5000, y: 5000, width: 1280, height: 820 };
  const result = clampBounds(saved, [primary], fallback);
  assert.equal(result.x, undefined);
  assert.equal(result.y, undefined);
});

test("a position on a removed second monitor is discarded", () => {
  const second = { x: 1920, y: 0, width: 1920, height: 1080 };
  const saved = { x: 2200, y: 200, width: 1200, height: 800 };
  assert.deepEqual(clampBounds(saved, [primary, second], fallback), saved);
  assert.equal(clampBounds(saved, [primary], fallback).x, undefined);
});

test("a mostly visible window keeps its position", () => {
  const saved = { x: -200, y: 200, width: 1200, height: 800 };
  assert.deepEqual(clampBounds(saved, [primary], fallback), saved);
});

test("tiny saved sizes are raised to the minimum", () => {
  const saved = { x: 10, y: 10, width: 200, height: 100 };
  const result = clampBounds(saved, [primary], fallback);
  assert.equal(result.width, MIN_WIDTH);
  assert.equal(result.height, MIN_HEIGHT);
});

test("garbage is ignored", () => {
  assert.deepEqual(clampBounds({ width: "wide" }, [primary], fallback), fallback);
  assert.deepEqual(clampBounds("nope", [primary], fallback), fallback);
});
