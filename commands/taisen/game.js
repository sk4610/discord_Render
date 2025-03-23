import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../utils/database.js';

//const sequelize = new Sequelize({
//  dialect: 'sqlite',
//  storage: path.join(process.cwd(), 'game.db'),
//  logging: false
//});



// 参加者情報
const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  name: DataTypes.STRING,
  team: DataTypes.STRING,
  rank: DataTypes.STRING,
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
sequelize.sync({ force: false }) // force: false にすると、テーブルが存在していれば再作成されません
  .then(() => {
    console.log('✅ Models synced successfully.');
  })
  .catch((error) => {
    console.error('❌ Failed to sync models:', error);
  });

export { sequelize, User, GameState };
