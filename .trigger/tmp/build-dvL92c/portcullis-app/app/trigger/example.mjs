import {
  logger,
  schedules_exports,
  wait
} from "../../../chunk-G4UJ3ANV.mjs";
import {
  init_esm
} from "../../../chunk-BW5JXM66.mjs";

// app/trigger/example.ts
init_esm();
var firstScheduledTask = schedules_exports.task({
  id: "first-scheduled-task",
  //every hour
  cron: "0 * * * *",
  run: async (payload, { ctx }) => {
    const distanceInMs = payload.timestamp.getTime() - (payload.lastTimestamp ?? /* @__PURE__ */ new Date()).getTime();
    logger.log("First scheduled tasks", { payload, distanceInMs });
    await wait.for({ seconds: 5 });
    const formatted = payload.timestamp.toLocaleString("en-US", {
      timeZone: payload.timezone
    });
    logger.log(formatted);
  }
});
export {
  firstScheduledTask
};
//# sourceMappingURL=example.mjs.map
