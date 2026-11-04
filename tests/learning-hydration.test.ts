import {expect,it} from "vitest";
import {canMutateLearning} from "@/lib/learning/session";
it("blocks member writes and imports until the matching account state loaded successfully",()=>{
 expect(canMutateLearning("a","a",false)).toBe(false);
 expect(canMutateLearning("b","a",true)).toBe(false);
 expect(canMutateLearning("a","a",true)).toBe(true);
});
