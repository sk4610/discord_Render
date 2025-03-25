import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { getArmyName } from '../kaikyu/kaikyu.mjs';
import { kaikyu_main } from '../kaikyu/kaikyu_main.js';


export const data = new SlashCommandBuilder()
  .setName('gekiha')
  .setDescription('撃破数を決定します')
  .addStringOption(option =>
      option.setName("message")
      .setDescription("一言レスを表示") // 一行レスを打つことができる
      .setRequired(false) // trueにすると必須、falseにすると任意 
  );

// 現在のルールを取得する関数
async function getGameRule() {
  const gameState = await GameState.findOne({ where: { id: 1 } }); // ゲームの状態を取得
  return gameState ? gameState.rule_type : null;
}

export async function execute(interaction) {
  const userId = interaction.user.id;
  const username = interaction.member.displayName;
  const customMessage = interaction.options.getString("message") || ""; // メッセージ取得（デフォルトは空）

  
    
  try {
    const rule_type = await getGameRule(); // Sequelizeからルールを取得

    if (!rule_type) {
      return await interaction.reply('エラー: ルールが設定されていません。まず /rule でルールを決めてください。');
    }
    
    if (rule_type === 'ranked') {
      // **階級制の処理**
      await kaikyu_main(interaction); // kaikyu_main.jsを実行
    }else {
      await interaction.reply('エラー: 未知のルール「${rule_type}」です。');
    } 
  }catch (error) {
      console.error('撃破処理エラー0:', error);
      await interaction.reply('エラー0: 撃破処理に失敗しました');
  }
}
