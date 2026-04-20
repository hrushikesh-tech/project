import { Injectable, MessageEvent } from "@nestjs/common";
import { BiDashboardRefreshEvent } from "@amdox/types";
import { Observable, Subject, interval, map, merge } from "rxjs";

const REFRESH_INTERVAL_MS = 30_000;

@Injectable()
export class BiRefreshService {
  private readonly subjects = new Map<string, Subject<MessageEvent>>();

  streamDashboard(
    dashboardId: string,
    metricKeys: string[],
    widgetIds: string[],
  ): Observable<MessageEvent> {
    const subject = this.getSubject(dashboardId);

    return merge(
      interval(REFRESH_INTERVAL_MS).pipe(
        map(() => this.toMessageEvent({ dashboardId, metricKeys, widgetIds })),
      ),
      subject.asObservable(),
    );
  }

  emitRefresh(dashboardId: string, metricKeys: string[], widgetIds: string[]) {
    this.getSubject(dashboardId).next(
      this.toMessageEvent({ dashboardId, metricKeys, widgetIds }),
    );
  }

  private getSubject(dashboardId: string) {
    if (!this.subjects.has(dashboardId)) {
      this.subjects.set(dashboardId, new Subject<MessageEvent>());
    }
    return this.subjects.get(dashboardId)!;
  }

  private toMessageEvent(params: {
    dashboardId: string;
    metricKeys: string[];
    widgetIds: string[];
  }): MessageEvent {
    const payload: BiDashboardRefreshEvent = {
      dashboardId: params.dashboardId,
      timestamp: new Date().toISOString(),
      metricKeys: params.metricKeys as BiDashboardRefreshEvent["metricKeys"],
      widgetIds: params.widgetIds,
    };

    return {
      type: "dashboard.refresh",
      data: payload,
    };
  }
}
