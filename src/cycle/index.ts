import { cycleCheckpoint } from "./tools/cycleCheckpoint.ts";
import { cycleGoto } from "./tools/cycleGoto.ts";
import { cycleList } from "./tools/cycleList.ts";
import { cycleNext } from "./tools/cycleNext.ts";
import { cycleStartItems } from "./tools/cycleStartItems.ts";
import { cycleStartPlan } from "./tools/cycleStartPlan.ts";
import { cycleStatus } from "./tools/cycleStatus.ts";

export const toolsCycle = [
	cycleStartPlan,
	cycleStartItems,
	cycleNext,
	cycleCheckpoint,
	cycleStatus,
	cycleGoto,
	cycleList,
];
