import { describe, it, expect } from "vitest";
import { DESIGN_ITEM, withDesignItem } from "./design-reference";

describe("withDesignItem", () => {
  it("adds the design item once", () => {
    expect(withDesignItem(["Has a menu"])).toEqual(["Has a menu", DESIGN_ITEM]);
    expect(withDesignItem(["Has a menu", DESIGN_ITEM])).toEqual(["Has a menu", DESIGN_ITEM]);
  });
});
