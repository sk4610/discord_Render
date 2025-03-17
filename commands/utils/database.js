import Database from "better-sqlite3";

// データベースを作成（または開く）
const db = new Database("botdata.sqlite");

// 所持金テーブルを作成（初回のみ）
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 0
  )
`).run();

export default db;
