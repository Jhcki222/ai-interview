import {expect,it} from "vitest";
import {buildImportBatches,importSchema} from "@/lib/learning/import";
it("splits large Korean drafts below the route byte ceiling without dropping records",()=>{
 const entries=Object.fromEntries(Array.from({length:25},(_,index)=>[`base:${index}`,"한".repeat(20000)]));
 const batches=buildImportBatches(entries,{});
 expect(batches.flatMap(batch=>batch.answers)).toHaveLength(25);
 expect(batches.every(batch=>new TextEncoder().encode(JSON.stringify(batch)).byteLength<180000)).toBe(true);
 expect(batches.every(batch=>importSchema.safeParse(batch).success)).toBe(true);
});
