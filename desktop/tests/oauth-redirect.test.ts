import test from "node:test";
import assert from "node:assert/strict";
import { isOAuthNavigation } from "../src/oauth-urls.ts";

test("google consent is external", () => {
  assert.equal(isOAuthNavigation("https://accounts.google.com/o/oauth2/v2/auth?x=1"), true);
});

test("supabase hosted authorize is external", () => {
  assert.equal(
    isOAuthNavigation("https://purcbbalpuovesdndlik.supabase.co/auth/v1/authorize?provider=google"),
    true,
  );
});

test("the app itself stays inside the window", () => {
  assert.equal(isOAuthNavigation("http://127.0.0.1:43110/app"), false);
  assert.equal(isOAuthNavigation("http://127.0.0.1:43110/login?error=exchange"), false);
});

test("lookalike hosts are not treated as oauth", () => {
  assert.equal(isOAuthNavigation("https://accounts.google.com.evil.test/x"), false);
  assert.equal(isOAuthNavigation("https://evil.test/auth/v1/authorize"), false);
});

test("garbage input is not oauth", () => {
  assert.equal(isOAuthNavigation("not a url"), false);
});
