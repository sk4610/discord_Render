import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { getArmyName } from '../kaikyu/kaikyu.mjs';
import { kaikyu_main } from '../kaikyu/kaikyu_main.js';
import { sendEndShukei } from "../shukei/shukeiNotice.js";
import { checkShusen } from '../taisen/game.js';
import { armyNames } from '../armyname/armyname.js';

export const data = new SlashCommandBuilder()
  .setName('gekiha')
  .setDescription('敵を撃破します')
  .addStringOption(option =>
      option.setName("message")
      .setDescription("一言添える") // 一行レスを打つことができる
      .setRequired(false) // trueにすると必須、falseにすると任意 
  );

// 現在のルールを取得する関数
async function getGameRule() {
  const gameState = await GameState.findOne({ where: { id: 1 } }); // ゲームの状態を取得
  return gameState ? gameState.rule_type : null;
}

// State.countMode を取得する関数
async function getCountMode() {
  const gameState = await GameState.findOne({ where: { id: 1 } });
  return gameState ? gameState.countMode : "up"; // デフォルトは up
}

export async function execute(interaction) {
  const userId = interaction.user.id;
  const username = interaction.member.displayName;
  const customMessage = interaction.options.getString("message") || ""; // メッセージ取得（デフォルトは空）
  const gameState = await GameState.findOne({ where: { id: 1 } });
  
    
  try {
    const rule_type = await getGameRule(); // Sequelizeからルールを取得
    const countMode = await getCountMode(); // ここで countMode を取得

    if (!rule_type) {
      return await interaction.reply('エラー: ルールが設定されていません。まず /rule でルールを決めてください。');
    }
    
    // 大戦が終了すると通知が変わる
    if (gameState.isGameOver) {
      await interaction.reply("大戦はすでに終了した！次回の号砲を待て！");
      return;
    }
    
   
    if (rule_type === 'ranked') {
      // **階級制の処理**
      await kaikyu_main(interaction); // kaikyu_main.jsを実行
    }else {
      await interaction.reply('エラー: 未知のルール「${rule_type}」です。');
    } 
    
    // 終戦判定
    // initialArmyHPはカウントダウン方式しか使わないためカウントダウンしか判定されない
    const loserTeam = await checkShusen();
    const WinnerTeam = await checkShusen();
    if (loserTeam) {
      const gameState = await GameState.findOne({ where: { id: 1 } });
      
      // 残存兵力チェック
      const totalKillsA = gameState.a_team_kills;
      const totalKillsB = gameState.b_team_kills;
      
      const remainingHP_A = gameState.initialArmyHP - totalKillsB;
      const remainingHP_B = gameState.initialArmyHP - totalKillsA;
      
      //終戦時の自動通知
      await interaction.followUp(`**${loserTeam}の兵力が0になった。**\n# ${WinnerTeam}**の勝利だ！\n\n\n\n_ **\n■最終結果\n 【${armyNames.A}の残存兵力】${remainingHP_A} \n 【${armyNames.B}の残存兵力】${remainingHP_B}\n\n**今次大戦は終戦した！次の大戦でまた会おう！**`);
      return;
    }


    
    // カウントダウンの場合、兵力をチェックして通知
    //const state = await GameState.findOne({ where: { id: 1 } });
    //if (state.countMode === "down" && state.initialArmyHP) {
//    if (countMode === "down") {
//      const gameState = await GameState.findOne({ where: { id: 1 } });
//      const remainingHP_A = gameState.initialArmyHP - gameState.b_team_kills;
//      const remainingHP_B = gameState.initialArmyHP - gameState.a_team_kills;

//      if (remainingHP_A <= 0) {
//        await sendEndShukei(interaction.client, "B軍の勝利！A軍の兵力が0になりました！");
//      } else if (remainingHP_B <= 0) {
//        await sendEndShukei(interaction.client, "A軍の勝利！B軍の兵力が0になりました！");
//     }
//    }
    
  }catch (error) {
      console.error('撃破処理エラー0:', error);
      await interaction.reply('エラー0: 撃破処理に失敗しました');
  }
}
