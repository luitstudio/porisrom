import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createAdapter, PostgresAdapter } from "@socket.io/postgres-adapter";
import { Pool, type PoolClient } from "pg";
import type { Server } from "socket.io";

@Injectable()
export class RealtimeClusterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeClusterService.name);
  private readonly pool?: Pool;
  private readonly clients = new Set<PoolClient>();
  private readonly prefix: string;
  private server?: Server;
  private readonly expectedInstances: number;

  constructor(config: ConfigService) {
    const adapter = config.get<string>("SOCKET_ADAPTER") ?? "memory";
    const expected = Number(config.get("REALTIME_EXPECTED_INSTANCES") ?? 1);
    this.expectedInstances = expected;
    if (!["memory", "postgres"].includes(adapter) || !Number.isInteger(expected) || expected < 1 || (expected > 1 && adapter !== "postgres")) {
      throw new Error("Multiple backend instances require SOCKET_ADAPTER=postgres");
    }
    this.prefix = config.get<string>("SOCKET_CHANNEL_PREFIX") ?? "porisrom";
    if (!/^[a-zA-Z0-9_.:-]{1,40}$/.test(this.prefix)) throw new Error("Invalid SOCKET_CHANNEL_PREFIX");
    if (adapter === "postgres") {
      this.pool = new Pool({ connectionString: config.getOrThrow<string>("DATABASE_URL"), max: 4, connectionTimeoutMillis: 2000, statement_timeout: 2000 });
      this.pool.on("connect", (client) => { this.clients.add(client); client.once("end", () => this.clients.delete(client)); });
      this.pool.on("error", () => this.logger.error("realtime_backplane_unavailable"));
    }
  }

  async onModuleInit() {
    // Migration-owned table: startup must not create/modify application schemas.
    if (this.pool) await this.pool.query("SELECT id FROM socket_io_attachments LIMIT 0");
  }

  attach(server: Server) {
    this.server = server;
    if (this.pool) server.adapter(createAdapter(this.pool, {
      channelPrefix: this.prefix, tableName: "socket_io_attachments", cleanupInterval: 30000,
      errorHandler: () => this.logger.error("realtime_backplane_unavailable"),
    }));
    // Start heartbeats before readiness waits for peer discovery; waiting for the
    // first application broadcast would otherwise deadlock an idle cluster.
    if (this.pool) (server.of("/").adapter as PostgresAdapter).init();
  }

  async ready() {
    if (!this.pool) return true;
    // A healthy generic SQL connection does not establish that this instance's
    // adapter subscribed. Check the actual pool clients' LISTEN channels.
    for (const client of this.clients) {
      try {
        const result = await client.query<{ channel: string }>("SELECT pg_listening_channels() AS channel");
        if (result.rows.some((row) => row.channel === `${this.prefix}#/`)) {
          return !!this.server && await this.server.of("/").adapter.serverCount() >= this.expectedInstances;
        }
      } catch { /* Fail readiness until a subscribed connection recovers. */ }
    }
    return false;
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.server?.of("/").adapter.close();
      await this.pool.end();
    }
  }
}
