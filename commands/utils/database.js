import { Sequelize } from "sequelize";
import fs from 'fs';
import path from 'path';

const dataDir = "./data";
const dbPath = path.join(dataDir, "botdata.sqlite");

// dataディレクトリがなければ作成
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('📁 data ディレクトリを作成しました');
}

// 既存のデータベースを削除（起動時に1回だけ）
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('🗑️ 古いデータベースを削除しました');
}

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: dbPath,
  logging: false,
});

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