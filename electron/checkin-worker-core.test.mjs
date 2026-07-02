import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyCheckinResponse,
  isSameTargetPage,
  matchesResponseUrl,
} from "./checkin-worker-core.mjs";

test("matches response urls by substring or regex-like slash pattern", () => {
  assert.equal(
    matchesResponseUrl("https://work.example.com/api/checkin/status?ts=1", "/api/checkin/status"),
    true,
  );
  assert.equal(
    matchesResponseUrl("https://work.example.com/api/checkin/status?ts=1", "/api/checkin/.+"),
    true,
  );
  assert.equal(matchesResponseUrl("https://work.example.com/api/profile", "/api/checkin/status"), false);
});

test("compares target page by origin and pathname only", () => {
  assert.equal(
    isSameTargetPage(
      "https://work.example.com/checkin?ticket=abc#done",
      "https://work.example.com/checkin",
    ),
    true,
  );
  assert.equal(isSameTargetPage("https://work.example.com/login", "https://work.example.com/checkin"), false);
});

test("classifies checkin response by ok status and keyword", () => {
  assert.deepEqual(classifyCheckinResponse(200, "今天已打卡成功", "已打卡"), {
    ok: true,
    checkedIn: true,
  });
  assert.deepEqual(classifyCheckinResponse(200, "今天还未完成", "已打卡"), {
    ok: true,
    checkedIn: false,
  });
  assert.deepEqual(classifyCheckinResponse(500, "已打卡", "已打卡"), {
    ok: false,
    checkedIn: false,
  });
});
