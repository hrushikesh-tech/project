import { Logger, Provider } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue } from "bullmq";

type RepeatableJob = {
  id?: string | null;
  key: string;
};

type RepeatableQueueLike<T> = Pick<
  Queue<T>,
  "add" | "getRepeatableJobs" | "removeRepeatableByKey"
>;

class NoopQueue<T> implements RepeatableQueueLike<T> {
  private readonly logger: Logger;

  constructor(private readonly queueName: string) {
    this.logger = new Logger(`NoopQueue:${queueName}`);
  }

  async add(name: string, _data: T, _opts?: unknown) {
    this.logger.warn(
      `Skipped job "${name}" because queue "${this.queueName}" is disabled.`,
    );
    return {
      id: `disabled:${this.queueName}:${name}`,
      name,
      queueName: this.queueName,
    };
  }

  async getRepeatableJobs(): Promise<RepeatableJob[]> {
    return [];
  }

  async removeRepeatableByKey(_key: string) {
    return;
  }
}

export function areBackgroundQueuesEnabled() {
  if (process.env.REDIS_DISABLED === "true") {
    return false;
  }

  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
}

export function createQueueProvider(queueName: string): Provider {
  return {
    provide: getQueueToken(queueName),
    useFactory: () => new NoopQueue(queueName),
  };
}
