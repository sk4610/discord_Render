import Database from "better-sqlite3";

// データベースを開く（または作成）
const db = new Database("botdata.sqlite");

// 通知テーブルを作成（初回のみ）
db.prepare(`
  CREATE TABLE IF NOT EXISTS notifications (
    guildId TEXT PRIMARY KEY,
    voiceChannelId TEXT,
    textChannelId TEXT
  )
`).run();

/**
 * 通知設定を追加または更新
 * @param {string} guildId - サーバーID
 * @param {string} voiceChannelId - ボイスチャンネルID
 * @param {string} textChannelId - テキストチャンネルID
 */
export function setNotification(guildId, voiceChannelId, textChannelId) {
  db.prepare(`
    INSERT INTO notifications (guildId, voiceChannelId, textChannelId)
    VALUES (?, ?, ?)
    ON CONFLICT(guildId) DO UPDATE SET
      voiceChannelId = excluded.voiceChannelId,
      textChannelId = excluded.textChannelId
  `).run(guildId, voiceChannelId, textChannelId);
}

/**
 * 指定されたギルド（サーバー）の通知設定を取得
 * @param {string} guildId - サーバーID
 * @returns {object|null} - 通知設定（なければ null）
 */
export function getNotification(guildId) {
  return db.prepare(`
    SELECT * FROM notifications WHERE guildId = ?
  `).get(guildId);
}

/**
 * 指定されたギルド（サーバー）の通知設定を削除
 * @param {string} guildId - サーバーID
 */
export function removeNotification(guildId) {
  db.prepare(`
    DELETE FROM notifications WHERE guildId = ?
  `).run(guildId);
}

// デフォルトエクスポート（他のモジュールでも使えるようにする）
export default db;