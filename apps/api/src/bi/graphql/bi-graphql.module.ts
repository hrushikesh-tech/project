import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { simpleEstimator, createComplexityRule } from "graphql-query-complexity";
import depthLimit from "graphql-depth-limit";
import { PrismaModule } from "../../prisma/prisma.module";
import { BiModule } from "../bi.module";
import { BiMetricResolver } from "./resolvers/bi-metric.resolver";
import { BiDashboardResolver } from "./resolvers/bi-dashboard.resolver";
import { BiWidgetResolver } from "./resolvers/bi-widget.resolver";
import { BiWidgetLoader } from "./loaders/bi-widget.loader";
import { JsonScalar } from "./json.scalar";
import { createTrustedOperationsMiddleware } from "./plugins/trusted-operations.plugin";

function isProductionEnvironment() {
  return (process.env.NODE_ENV ?? "development") === "production";
}

function resolveApiRoot() {
  const candidates = [
    resolve(__dirname, "../../.."),
    resolve(__dirname, "../../../.."),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
  }

  return resolve(process.cwd(), "apps/api");
}

function resolveGraphqlAssetPath(...segments: string[]) {
  return join(resolveApiRoot(), ...segments);
}

function resolveGraphqlSchemaGlob() {
  const distSchemaDir = resolveGraphqlAssetPath("dist", "src", "bi", "graphql", "schema");
  if (existsSync(distSchemaDir)) {
    return join(distSchemaDir, "*.graphql");
  }

  return resolveGraphqlAssetPath("src", "bi", "graphql", "schema", "*.graphql");
}

function resolveTrustedOperationsManifestPath() {
  const distManifestPath = resolveGraphqlAssetPath(
    "dist",
    "src",
    "bi",
    "graphql",
    "trusted-operations.json",
  );
  if (existsSync(distManifestPath)) {
    return distManifestPath;
  }

  return resolveGraphqlAssetPath(
    "src",
    "bi",
    "graphql",
    "trusted-operations.json",
  );
}

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BiModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const maxDepth = Number(configService.get("GRAPHQL_MAX_DEPTH", 7));
        const maxComplexity = Number(
          configService.get("GRAPHQL_MAX_COMPLEXITY", 1000),
        );

        return {
          driver: ApolloDriver,
          path: "/graphql",
          typePaths: [resolveGraphqlSchemaGlob()],
          definitions: isProductionEnvironment()
            ? undefined
            : {
                path: resolveGraphqlAssetPath(
                  "src",
                  "bi",
                  "graphql",
                  "generated.ts",
                ),
                outputAs: "class" as const,
              },
          sortSchema: true,
          introspection: isProductionEnvironment()
            ? false
            : configService.get("GRAPHQL_INTROSPECTION", "true") !== "false",
          playground: !isProductionEnvironment(),
          context: ({ req }) => ({ req }),
          validationRules: [
            depthLimit(maxDepth),
            createComplexityRule({
              maximumComplexity: maxComplexity,
              variables: {},
              onComplete: () => undefined,
              estimators: [simpleEstimator({ defaultComplexity: 1 })],
            }),
          ],
        };
      },
    }),
  ],
  providers: [
    JsonScalar,
    BiMetricResolver,
    BiDashboardResolver,
    BiWidgetResolver,
    BiWidgetLoader,
  ],
})
export class BiGraphqlModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        createTrustedOperationsMiddleware(resolveTrustedOperationsManifestPath()),
      )
      .forRoutes("/graphql");
  }
}
