import { rmSync } from 'node:fs';

const dbPath = process.env.DIPLOMACY_DB_PATH;
if (dbPath) {
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(dbPath + suffix, { force: true });
  }
}
