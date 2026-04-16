declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  const pdfjs: any;
  export = pdfjs;
}

declare module '@nestjs/schedule' {
  export const CronExpression: Record<string, string>;
  export function Cron(cronTime: string, options?: Record<string, unknown>): MethodDecorator;
  export class ScheduleModule {
    static forRoot(): any;
  }
}

declare module '@nestjs/schedule/dist' {
  export const CronExpression: Record<string, string>;
  export function Cron(cronTime: string, options?: Record<string, unknown>): MethodDecorator;
  export class ScheduleModule {
    static forRoot(): any;
  }
}
