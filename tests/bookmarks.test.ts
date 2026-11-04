import {expect,it} from "vitest";
import {resolveBookmarks,filterBookmarks} from "@/lib/learning/bookmarks";
import {questions} from "@/lib/questions";
it("keeps original and personal snapshots separate even when their source IDs match",()=>{
 const entries=resolveBookmarks([questions[0]],[{id:"personal",question:questions[0],note:""}],{answers:{},progress:{[`base:${questions[0].id}`]:{status:"COMPLETED",bookmarked:true},"saved:personal":{status:"NEEDS_REVIEW",bookmarked:true},"saved:missing":{status:"NOT_STARTED",bookmarked:true}}});
 expect(entries.map(entry=>entry.key).sort()).toEqual([`base:${questions[0].id}`,"saved:personal"].sort());
 expect(filterBookmarks(entries,{source:"created",status:"NEEDS_REVIEW"})).toHaveLength(1);
 expect(filterBookmarks(entries,{source:"base",status:"NEEDS_REVIEW"})).toHaveLength(0);
});
