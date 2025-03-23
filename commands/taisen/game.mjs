import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(process.cwd(), 'game.db'),
  logging: false
});

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
  a_team_kills: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  b_team_kills: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

export { sequelize, User, GameState };
