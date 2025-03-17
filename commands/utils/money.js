import { DataTypes } from "sequelize";
import sequelize from "../utils/database.js"; // データベース接続をインポート

// ユーザーの所持金を管理するテーブル
const Money = sequelize.define("Money", {
  userId: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  balance: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

// データベースを同期（テーブルがなければ作成）
sequelize.sync();

/**
 * 指定したユーザーの所持金を取得
 */
async function getBalance(userId) {
  const user = await Money.findByPk(userId);
  return user ? user.balance : 0;
}

/**
 * 所持金を追加
 */
async function addMoney(userId, amount) {
  const user = await Money.findByPk(userId);
  if (user) {
    user.balance += amount;
    await user.save();
  } else {
    await Money.create({ userId, balance: amount });
  }
}

/**
 * 所持金を減らす（不足時は何もしない）
 */
async function subtractMoney(userId, amount) {
  const user = await Money.findByPk(userId);
  if (user && user.balance >= amount) {
    user.balance -= amount;
    await user.save();
    return true;
  }
  return false; // 所持金が足りない場合
}

// CommonJS エクスポートではなく、ES モジュールでデフォルトエクスポート
export default { getBalance, addMoney, subtractMoney };
