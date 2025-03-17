import Database from "better-sqlite3";

// データベースを開く（または作成）
const db = new Database("botdata.sqlite");

// YouTubeフィードテーブルを作成（初回のみ）
db.prepare(`
  CREATE TABLE IF NOT EXISTS youtube_feeds (
    channelFeedUrl TEXT PRIMARY KEY,
    channelLatestUpdateDate TEXT
  )
`).run();

/**
 * YouTubeフィードを追加または更新
 * @param {string} channelFeedUrl - YouTubeチャンネルのフィードURL
 * @param {string} channelLatestUpdateDate - 最新の更新日時
 */
export function setYoutubeFeed(channelFeedUrl, channelLatestUpdateDate) {
  db.prepare(`
    INSERT INTO youtube_feeds (channelFeedUrl, channelLatestUpdateDate)
    VALUES (?, ?)
    ON CONFLICT(channelFeedUrl) DO UPDATE SET
      channelLatestUpdateDate = excluded.channelLatestUpdateDate
  `).run(channelFeedUrl, channelLatestUpdateDate);
}

/**
 * 指定されたチャンネルのYouTubeフィードを取得
 * @param {string} channelFeedUrl - YouTubeチャンネルのフィードURL
 * @returns {object|null} - フィード情報（なければ null）
 */
export function getYoutubeFeed(channelFeedUrl) {
  return db.prepare(`
    SELECT * FROM youtube_feeds WHERE channelFeedUrl = ?
  `).get(channelFeedUrl);
}

/**
 * 全てのYouTubeフィードを取得
 * @returns {Array} - すべてのフィードデータの配列
 */
export function getAllYoutubeFeeds() {
  return db.prepare(`
    SELECT * FROM youtube_feeds
  `).all();
}

/**
 * 指定されたチャンネルのYouTubeフィードを削除
 * @param {string} channelFeedUrl - YouTubeチャンネルのフィードURL
 */
export function removeYoutubeFeed(channelFeedUrl) {
  db.prepare(`
    DELETE FROM youtube_feeds WHERE channelFeedUrl = ?
  `).run(channelFeedUrl);
}

// デフォルトエクスポート（他のモジュールでも使えるようにする）
export default db;
