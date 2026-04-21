export const CronExpression = {
  EVERY_5_SECONDS: "*/5 * * * * *",
  EVERY_DAY_AT_1AM: "0 1 * * *",
  EVERY_6_HOURS: "0 */6 * * *",
  EVERY_WEEK: "0 2 * * 1",
};

export function Cron(
  _cronTime: string,
  _options?: Record<string, unknown>,
): MethodDecorator {
  return () => undefined;
}
