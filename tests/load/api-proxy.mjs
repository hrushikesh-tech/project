import http from "node:http";

const listenPort = Number(process.env.PORT_API ?? "3101");
const targets = (process.env.LOAD_PROXY_TARGETS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((port) => Number(port))
  .filter((port) => Number.isFinite(port) && port > 0);

if (targets.length === 0) {
  throw new Error("LOAD_PROXY_TARGETS must provide at least one backend port.");
}

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 8192,
  maxFreeSockets: 512,
});

let index = 0;

function nextTargetPort() {
  const port = targets[index % targets.length];
  index += 1;
  return port;
}

const server = http.createServer((request, response) => {
  const bodyChunks = [];

  request.on("data", (chunk) => {
    bodyChunks.push(chunk);
  });

  request.on("end", () => {
    const requestBody = bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : null;

    const tryProxy = (attempt) => {
      const targetPort = nextTargetPort();
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: targetPort,
          method: request.method,
          path: request.url,
          headers: request.headers,
          agent,
        },
        (upstreamResponse) => {
          response.writeHead(
            upstreamResponse.statusCode ?? 502,
            upstreamResponse.headers,
          );
          upstreamResponse.pipe(response);
        },
      );

      upstream.on("error", () => {
        if (attempt + 1 < targets.length) {
          tryProxy(attempt + 1);
          return;
        }

        if (!response.headersSent) {
          response.writeHead(502, { "content-type": "application/json" });
        }
        response.end(
          JSON.stringify({
            error: {
              code: "LoadProxyUnavailable",
              message: "Upstream API worker is unavailable.",
            },
          }),
        );
      });

      if (requestBody) {
        upstream.end(requestBody);
        return;
      }

      upstream.end();
    };

    tryProxy(0);
  });
});

server.listen(listenPort, "0.0.0.0", () => {
  console.log(
    `Load proxy listening on http://127.0.0.1:${listenPort} -> ${targets.join(",")}`,
  );
});
