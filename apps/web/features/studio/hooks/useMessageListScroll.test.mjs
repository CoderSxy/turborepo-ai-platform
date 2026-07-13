import assert from "node:assert/strict";
import test from "node:test";

import { isMessageListNearBottom } from "./useMessageListScroll.ts";

test("isMessageListNearBottom returns true when scrolled to bottom", () => {
  assert.equal(isMessageListNearBottom(420, 500, 80), true);
});

test("isMessageListNearBottom returns false when user scrolled up", () => {
  assert.equal(isMessageListNearBottom(100, 500, 80), false);
});

test("isMessageListNearBottom respects threshold", () => {
  assert.equal(isMessageListNearBottom(330, 500, 80, 100), true);
  assert.equal(isMessageListNearBottom(310, 500, 80, 100), false);
});
