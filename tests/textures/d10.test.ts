import { describe, expect, it } from "vitest";
import { D10Texture, DPercentileTexture } from "../../src/textures/d10";

class TestableD10Texture extends D10Texture {
    public getFaceLabel(face: number): string {
        return super.getFaceLabel(face);
    }
}

class TestableDPercentileTexture extends DPercentileTexture {
    public getFaceLabel(face: number): string {
        return super.getFaceLabel(face);
    }
}

describe("d10 texture", () => {
    it("labels faces 0-9 for values 1-10", () => {
        const texture = new TestableD10Texture();
        expect(texture.getFaceLabel(1)).toBe("1");
        expect(texture.getFaceLabel(9)).toBe("9");
        expect(texture.getFaceLabel(10)).toBe("0");
    });
});

describe("percentile texture", () => {
    it("labels faces 00-90 for values 10-100", () => {
        const texture = new TestableDPercentileTexture();
        expect(texture.getFaceLabel(10)).toBe("10");
        expect(texture.getFaceLabel(90)).toBe("90");
        expect(texture.getFaceLabel(100)).toBe("00");
    });
});
