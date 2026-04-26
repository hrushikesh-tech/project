import { ExecutionContext } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";

type RequestLike = {
  user?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

export function getRequestFromExecutionContext(
  context: ExecutionContext,
): RequestLike {
  if (context.getType<string>() === "graphql") {
    const gqlContext = GqlExecutionContext.create(context).getContext<{
      req?: RequestLike;
      request?: RequestLike;
    }>();
    return gqlContext.req ?? gqlContext.request ?? {};
  }

  return context.switchToHttp().getRequest<RequestLike>();
}
