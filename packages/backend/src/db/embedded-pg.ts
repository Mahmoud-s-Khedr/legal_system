export interface EmbeddedPostgresConfig {
  port: number;
  dataDir: string;
}

export function getEmbeddedPostgresConfig(): EmbeddedPostgresConfig {
  return {
    port: Number(process.env.DESKTOP_POSTGRES_PORT ?? 5433),
    dataDir: ".elms/postgres"
  };
}
