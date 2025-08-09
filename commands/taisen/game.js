import { Sequelize, DataTypes } from 'sequelize';
import sequelize from '../utils/database.js';
import { armyNames } from '../armyname/armyname.js';

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
  username: DataTypes.STRING,
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
  },
 // BOBを使用するか
  bobEnabled: {  
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  // 属性コイン制　個人のコイン取得履歴（戦績表示用）
  personal_fire_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  personal_wood_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  personal_earth_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  personal_thunder_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  personal_water_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // ビースト関連フィールド（新規追加）
  beast_name: { type: DataTypes.STRING, defaultValue: null },
  beast_atk: { type: DataTypes.INTEGER, defaultValue: 0 },
  beast_is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  beast_has_fed: { type: DataTypes.BOOLEAN, defaultValue: false },
  last_action_time: { type: DataTypes.DATE, defaultValue: null },
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
  // 大戦の終戦方式を決定
  countMode: {  
    type: DataTypes.STRING,
    defaultValue: 'down'
  },    
  // 初期HPの決定（カウントダウン方式のみ）
  initialArmyHP: {  
    type: DataTypes.INTEGER,
    defaultValue: 100
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
  },
  // 終戦状態をフラグ管理
  isGameOver: {   
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // ===== 属性コイン制で使用　軍全体のコイン管理 =====
  // A軍のコイン
  a_fire_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  a_wood_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  a_earth_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  a_thunder_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  a_water_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  
  // B軍のコイン
  b_fire_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  b_wood_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  b_earth_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  b_thunder_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  b_water_coin: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
 // ビースト決闘管理（新規追加）
  duel_interval: { type: DataTypes.INTEGER, defaultValue: 50 }, // 決闘間隔
  last_duel_round: { type: DataTypes.INTEGER, defaultValue: 0 },
  notification_40_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
  notification_30_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
  notification_20_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
  notification_10_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
  notification_5_sent: { type: DataTypes.BOOLEAN, defaultValue: false },


});

// 決闘記録テーブル（ビースト制用）
const BeastDuel = sequelize.define('BeastDuel', {
  round_number: { type: DataTypes.INTEGER },
  player1_id: { type: DataTypes.STRING },
  player1_name: { type: DataTypes.STRING },
  player1_beast_name: { type: DataTypes.STRING },
  player1_atk: { type: DataTypes.INTEGER },
  player2_id: { type: DataTypes.STRING },
  player2_name: { type: DataTypes.STRING },
  player2_beast_name: { type: DataTypes.STRING },
  player2_atk: { type: DataTypes.INTEGER },
  winner_id: { type: DataTypes.STRING },
  damage_dealt: { type: DataTypes.INTEGER },
  duel_time: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

/**
 * 終戦かどうかをチェックする 終戦だった場合、isGameOverをtrueにしてフラグをON、その結果をgekiha.mjsで判定して自動通知させる
 * @returns {Promise<string|null>} 負けた軍の名前（"きのこ軍" or "たけのこ軍"）、または null（未終戦）
 */

export async function checkShusen() {
  const gameState = await GameState.findOne({ where: { id: 1 } });
  if (!gameState) {
    console.error("❌ GameState not found.");
    return null;
  }

  // 残りHPの計算
  const remainingHP_A = gameState.initialArmyHP - gameState.b_team_kills;
  const remainingHP_B = gameState.initialArmyHP - gameState.a_team_kills;

//    console.log(`🛡️ 兵力状況 - A軍: ${remainingHP_A}, B軍: ${remainingHP_B}`);
  // どちらかの軍のHPが0以下になったら終戦
  if (remainingHP_A <= 0 || remainingHP_B <= 0) {
    const loserTeam = remainingHP_A <= 0 ? armyNames.A : armyNames.B ; // 敗北軍
    const winnerTeam = loserTeam === armyNames.A ? armyNames.B : armyNames.A; // 勝利軍

    try {
      await gameState.update({ isGameOver: true });  // 終戦フラグをON
      await gameState.reload(); // 更新後のデータを同期
//      console.log(`⚔️ ${loserTeam}の兵力が尽きました。終戦しました！`);
    } catch (error) {
      console.error("❌ 終戦状態の更新に失敗:", error);
    }

    return loserTeam;
    return winnerTeam;
  }

  return null;  // まだ終戦していない
}

// テーブルの同期（テーブルが存在しない場合は作成されます）
// 新しいコマンドを作成したときなど一度trueにしてからfalseにすると作成されエラーを回避できる
sequelize.sync({ force: true  }) // force: false にすると、テーブルが存在していれば再作成されません
  .then(() => {
    console.log('✅ Models synced successfully.');
  })
  .catch((error) => {
    console.error('❌ Failed to sync models:', error);
  });

export { sequelize, User, GameState };
