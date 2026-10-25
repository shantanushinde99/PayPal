import { describe, it, expect } from "vitest";
import { parsePhoto } from "./photo-input";

const jpeg = "data:image/jpeg;base64," + Buffer.from("fakejpeg").toString("base64");

describe("parsePhoto", () => {
  it("accepts a jpeg/png/webp data URL and returns mime + base64", () => {
    expect(parsePhoto(jpeg)).toEqual({ mimeType: "image/jpeg", data: Buffer.from("fakejpeg").toString("base64") });
    expect(parsePhoto(jpeg.replace("jpeg", "webp")).mimeType).toBe("image/webp");
  });
  it("rejects non-images, empty input and oversized photos", () => {
    expect(() => parsePhoto("data:text/html;base64,PGgxPg==")).toThrow();
    expect(() => parsePhoto("")).toThrow();
    expect(() => parsePhoto("data:image/jpeg;base64," + "A".repeat(4_000_000))).toThrow(/too large/i);
  });
});
