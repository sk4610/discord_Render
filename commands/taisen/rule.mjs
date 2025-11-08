import { SlashCommandBuilder } from 'discord.js';
import { GameState } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
  .setName('rule')
  .setDescription('ゲームのルールを設定します')
  .addStringOption(option =>
    option.setName('mode')
      .setDescription('ルールの種類')
      .setRequired(true)
      .addChoices(
        // ルール選択 nameがDiscord上に表示される文字、valueが内部処理で使用する変数
        // 階級制の選択処理 
        { name: '階級制', value: 'ranked' },
        // 属性コイン制の選択処理 
        { name: '属性コイン制', value: 'coin' },
        // ビースト制
        { name: 'ビースト制', value: 'beast' },
        // パッシブスキル制
        { name: 'パッシブスキル制', value: 'passive' },
        // ファイティング制
        { name: 'ファイティング制', value: 'fighting' }
      ));

export async function execute(interaction) {
  const mode = interaction.options.getString('mode');

  try {
    // ルールを設定 or 更新
    await GameState.upsert({ 
      id: 1,
      rule_set: true,  // ルールが設定されたフラグ
      rule_type: mode  // 選ばれたmodeをrule_typeに保存
    });



const gameState = await GameState.findByPk(1); // 保存した後にデータを確認
//console.log(gameState); // ここでgameStateの内容をログに出力

    if(mode === 'ranked'){
      await interaction.reply(`ルールを階級制に設定しました！ 参加者は /start コマンドで軍に参加してください。`); 
    }else if(mode === 'coin'){
      await interaction.reply(`ルールを属性コイン制に設定しました！ 参加者は /start コマンドで軍に参加してください。`);
    }else if(mode === 'beast'){
      await interaction.reply(`ルールをビースト制に設定しました！ 参加者は /start コマンドで軍に参加してください。`);
    }else if(mode === 'passive'){
      await interaction.reply(`ルールをパッシブスキル制に設定しました！ 参加者は /start コマンドで軍に参加してください。`);
    }else if(mode === 'fighting'){
      await interaction.reply(`ルールをファイティング制に設定しました！ 参加者は /start コマンドで軍に参加してください。`);
    }
    
    } catch (error) {
    console.error('ルール設定エラー:', error);
    await interaction.reply('エラー: ルールの設定に失敗しました');
  }
}
