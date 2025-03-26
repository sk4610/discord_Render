import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../utils/database.js';

//大戦の源となるデータベースファイル
//sequelizeのデータベースを呼び出しUser,GameStateを始めとした値に情報を格納している
//各大戦ルールについてはそれぞれのフォルダを参照のこと

// 参加者情報 User
const User = sequelize.define('User', {
  // ユーザIDを保存 ここではDiscordのユーザID
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  // ユーザネームを保存
  name: DataTypes.STRING,
  // ユーザ所属軍を保存
  army: DataTypes.STRING,
  // ユーザ階級を保存（階級制で使用）
  rank: DataTypes.STRING,
  // /gekihaを書き込む度にカウント　書き込み回数カウント
  gekiha_counts: { 
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // ユーザの合計撃破数をカウント
  total_kills: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }

});

// ゲームの状態を格納する GamaState
const GameState = sequelize.define('GameState', {
  // ruleがsetされたかどうかの状態を保存 trueならset,falseならnot set
  rule_set: {   
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // ruleの名称を保存
  rule_type: {  
    type: DataTypes.STRING,
    defaultValue: 'none'
  },
  //大戦モード
  count_mode: {
    type: DataTypes.STRING,
    defaultValue: 'up'   
  },
  
  // A軍の撃破数
  a_team_kills: { 
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // B軍の撃破数
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
