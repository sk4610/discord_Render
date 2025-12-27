import { Sequelize } from "sequelize";
import fs from 'fs';
const dbPath = "./data/botdata.sqlite";

// ⭐ 強制的にデータベースを削除
if (fs.existsSync(dbPath)) {
  try {
    fs.unlinkSync(dbPath);
    console.log('🗑️ 古いデータベースを削除しました');
  } catch (error) {
    console.error('⚠️ データベース削除失敗:', error);
  }
}
// SQLite データベースの接続設定
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./data/botdata.sqlite", // ファイルを統一
  logging: false, // ログ出力を抑制
});

// データベース接続をテスト
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected successfully.");
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
  }
}
testConnection();

export default sequelize;