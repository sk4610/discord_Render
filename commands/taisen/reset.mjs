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
  // ⭐ 最初に deferReply を追加（タイムアウト回避）
  await interaction.deferReply();
  
  try {
    const forceRecreate = interaction.options.getBoolean('force_recreate') || false;
    
    if (forceRecreate) {
      // 完全リセット（テーブル構造も含めて再作成）
      await interaction.editReply('🔄 **完全リセット開始中...**\nテーブル構造も含めて再作成します。');
      
      console.log('🗑️ テーブルを完全削除中...');
      await sequelize.drop();
      
      console.log('🔧 テーブルを再作成中...');
      await sequelize.sync({ force: true });
      
      console.log('✅ 完全リセット完了');
      await interaction.editReply('✅ **完全リセット完了！**\n新しいテーブル構造で大戦データが初期化されました。');
      
    } else {
      // 通常リセット（データのみ削除）
      console.log('🗑️ データのみリセット中...');
      
      // ⭐ truncate オプションで高速一括削除
      await User.destroy({ where: {}, truncate: true });
      await GameState.destroy({ where: {}, truncate: true });
      
      // ⭐ 不要な検証処理を削除（遅い原因）
      // await User.findAll(); ← これが遅い
      // await GameState.findAll(); ← これが遅い
      
      console.log('✅ データリセット完了');
      await interaction.editReply('🔄 **大戦データをリセットしました！**\n新しい戦いを始める準備ができました。');
    }
    
  } catch (error) {
    console.error('リセット処理エラー:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply('エラー: リセットに失敗しました');
    } else if (interaction.deferred) {
      if (error.message && error.message.includes('no such column')) {
        await interaction.editReply('⚠️ **テーブル構造エラー検出**\n新機能のカラムが不足しています。`/reset force_recreate:True` で完全リセットを実行してください。');
      } else {
        await interaction.editReply('エラー: リセットに失敗しました');
      }
    }
  }
}