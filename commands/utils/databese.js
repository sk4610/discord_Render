import Database from "better-sqlite3";

// データベースを作成（または開く）
const db = new Database("botdata.sqlite");

// ユーザーの所持金を管理するテーブルを作成（初回のみ）
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 0
  )
`).run();

// **データベースをエクスポート**
export default db;