export const config = {
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
  dataDir: process.env.DATA_DIR ?? 'data',
};
