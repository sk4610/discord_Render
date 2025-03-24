import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../utils/database.js';

//const sequelize = new Sequelize({
//  dialect: 'sqlite',
//  storage: path.join(process.cwd(), 'game.db'),
//  logging: false
//});

//大戦の源となるデータベースファイル
//sequelizeのデータベースを呼び出しUser,GameStateを始めとした関数に情報を格納している
//各大戦ルールについてはそれぞれのフォルダを参照のこと

// 参加者情報
const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  name: DataTypes.STRING,
  army: DataTypes.STRING,
  rank: DataTypes.STRING,
  gekiha_counts: { // /gekihaを書き込む度にカウント　書き込み回数カウント
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_kills: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }

});

// ゲームの状態
const GameState = sequelize.define('GameState', {
  rule_set: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  rule_type: {  // ルールの種類を保存
    type: DataTypes.STRING,
    defaultValue: 'none'
  },
  a_team_kills: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  b_team_kills: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

// テーブルの同期（テーブルが存在しない場合は作成されます）
// 新しいコマンドを作成したときなど一度trueにしてからfalseにすると作成されエラーを回避できる
sequelize.sync({ force: false  }) // force: false にすると、テーブルが存在していれば再作成されません
  .then(() => {
    console.log('✅ Models synced successfully.');
  })
  .catch((error) => {
    console.error('❌ Failed to sync models:', error);
  });

export { sequelize, User, GameState };
