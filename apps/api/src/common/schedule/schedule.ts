export const CronExpression = {
  EVERY_DAY_AT_1AM: '0 1 * * *',
};

export function Cron(_cronTime: string, _options?: Record<string, unknown>): MethodDecorator {
  return () => undefined;
}
