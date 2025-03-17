import Database from "better-sqlite3";

// データベースを開く（または作成）
const db = new Database("botdata.sqlite");

// YouTube通知テーブルを作成（初回のみ）
db.prepare(`
  CREATE TABLE IF NOT EXISTS youtube_notifications (
    guildId TEXT,
    textChannelId TEXT,
    channelName TEXT,
    channelUrl TEXT,
    channelFeedUrl TEXT,
    PRIMARY KEY (guildId, channelFeedUrl)
  )
`).run();

/**
 * YouTube通知を追加または更新
 * @param {string} guildId - サーバーID
 * @param {string} textChannelId - 通知を送るテキストチャンネルID
 * @param {string} channelName - YouTubeチャンネル名
 * @param {string} channelUrl - YouTubeチャンネルURL
 * @param {string} channelFeedUrl - YouTubeフィードURL
 */
export function setYoutubeNotification(guildId, textChannelId, channelName, channelUrl, channelFeedUrl) {
  db.prepare(`
    INSERT INTO youtube_notifications (guildId, textChannelId, channelName, channelUrl, channelFeedUrl)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guildId, channelFeedUrl) DO UPDATE SET
      textChannelId = excluded.textChannelId,
      channelName = excluded.channelName,
      channelUrl = excluded.channelUrl
  `).run(guildId, textChannelId, channelName, channelUrl, channelFeedUrl);
}

/**
 * 指定されたギルド（サーバー）のYouTube通知設定を取得
 * @param {string} guildId - サーバーID
 * @returns {Array} - そのサーバーに設定されている全YouTube通知のリスト
 */
export function getYoutubeNotifications(guildId) {
  return db.prepare(`
    SELECT * FROM youtube_notifications WHERE guildId = ?
  `).all(guildId);
}

/**
 * 指定されたYouTubeフィードの通知を削除
 * @param {string} guildId - サーバーID
 * @param {string} channelFeedUrl - YouTubeフィードURL
 */
export function removeYoutubeNotification(guildId, channelFeedUrl) {
  db.prepare(`
    DELETE FROM youtube_notifications WHERE guildId = ? AND channelFeedUrl = ?
  `).run(guildId, channelFeedUrl);
}

// デフォルトエクスポート（他のモジュールでも使えるようにする）
export default db;
