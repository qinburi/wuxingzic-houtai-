import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import type { AppState } from "./seed.js";

@Injectable()
export class PersistenceService implements OnModuleDestroy {
  private readonly driver = process.env.DATA_DRIVER || "file";
  private readonly statePath = path.resolve(process.cwd(), "server/data/runtime-state.json");
  private pool?: pg.Pool;

  async load(): Promise<AppState | null> {
    if (this.driver === "postgres" && process.env.DATABASE_URL) {
      this.pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      await this.pool.query(`
        create table if not exists app_state (
          id text primary key,
          payload jsonb not null,
          updated_at timestamptz not null default now()
        )
      `);
      await this.pool.query(`
        create table if not exists audit_log_archive (
          id text primary key,
          kind text not null,
          actor_id text not null,
          action text not null,
          target_type text not null,
          target_id text not null,
          result text not null,
          detail jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        )
      `);
      await this.pool.query(`
        create or replace function reject_audit_mutation() returns trigger as $$
        begin
          raise exception 'audit records are append only';
        end;
        $$ language plpgsql
      `);
      await this.pool.query("drop trigger if exists audit_archive_no_update on audit_log_archive");
      await this.pool.query("create trigger audit_archive_no_update before update or delete on audit_log_archive for each row execute function reject_audit_mutation()");
      const result = await this.pool.query<{ payload: AppState }>("select payload from app_state where id = $1", ["hannao"]);
      return result.rows[0]?.payload || null;
    }

    try {
      return JSON.parse(await readFile(this.statePath, "utf8")) as AppState;
    } catch {
      return null;
    }
  }

  async save(state: AppState) {
    if (this.driver === "postgres" && this.pool) {
      await this.pool.query(
        `insert into app_state (id, payload, updated_at) values ($1, $2, now())
         on conflict (id) do update set payload = excluded.payload, updated_at = now()`,
        ["hannao", JSON.stringify(state)]
      );
      for (const log of state.logs) {
        await this.pool.query(
          `insert into audit_log_archive (id, kind, actor_id, action, target_type, target_id, result, detail, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) on conflict (id) do nothing`,
          [log.id, log.kind, log.actorId, log.action, log.targetType, log.targetId, log.result, JSON.stringify({ actorName: log.actorName, departmentName: log.departmentName, requestId: log.requestId, detail: log.detail, ip: log.ip, device: log.device }), log.createdAt]
        );
      }
      return;
    }

    await mkdir(path.dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, JSON.stringify(state, null, 2), "utf8");
  }

  async backup(state: AppState) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.resolve(process.cwd(), "server/backups", `hannao-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    const payload = JSON.stringify({ format: "hannao-state-v1", createdAt: new Date().toISOString(), driver: this.driver, state }, null, 2);
    await writeFile(backupPath, payload, "utf8");
    const verified = JSON.parse(await readFile(backupPath, "utf8"));
    if (verified.format !== "hannao-state-v1" || !verified.state?.settings) throw new Error("备份恢复校验失败");
    return { path: path.relative(process.cwd(), backupPath), bytes: Buffer.byteLength(payload), verifiedAt: new Date().toISOString() };
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
