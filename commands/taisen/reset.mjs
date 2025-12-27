import { SlashCommandBuilder } from 'discord.js';
import { User, GameState, sequelize } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('大戦データをリセットします')
  .addBooleanOption(option =>
    option.setName('force_recreate')
      .setDescription('テーブル構造も含めて完全にリセット（新機能追加時のみ使用）')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  try {
    const forceRecreate = interaction.options.getBoolean('force_recreate') || false;
    
    if (forceRecreate) {
      // 完全リセット（テーブル構造も含めて再作成）
      await interaction.reply('🔄 **完全リセット開始中...**\nテーブル構造も含めて再作成します。');
      
      console.log('🗑️ テーブルを完全削除中...');
      await sequelize.drop();
      
      console.log('🔧 テーブルを再作成中...');
      await sequelize.sync({ force: true });
      
      console.log('✅ 完全リセット完了');
      await interaction.followUp('✅ **完全リセット完了！**\n新しいテーブル構造で大戦データが初期化されました。');
      
    } else {
      // 通常リセット（データのみ削除）
      console.log('🗑️ データのみリセット中...');
      
      // プレイヤーデータ削除
      await User.destroy({ where: {} });

      // ルールデータ削除
      await GameState.destroy({ where: {} });
      
      // リセット後のデータ確認
      const usersAfterReset = await User.findAll();
      const gameStateAfterReset = await GameState.findAll();
      
      console.log("リセット後の User データ:", usersAfterReset);
      console.log("リセット後の GameState データ:", gameStateAfterReset);
      
      await interaction.reply('🔄 **大戦データをリセットしました！**\n新しい戦いを始める準備ができました。');
    }
    
  } catch (error) {
    console.error('リセット処理エラー:', error);
    
    if (error.message.includes('no such column')) {
      await interaction.followUp('⚠️ **テーブル構造エラー検出**\n新機能のカラムが不足しています。`/reset force_recreate:True` で完全リセットを実行してください。');
    } else {
      await interaction.reply('エラー: リセットに失敗しました');
    }
  }
}