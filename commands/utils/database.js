import { Sequelize } from "sequelize";

// ⭐ 起動時にデータベースファイルを削除
const dbPath = "./data/botdata.sqlite";
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('🗑️ 古いデータベースを削除しました');
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