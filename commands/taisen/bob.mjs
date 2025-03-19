import { SlashCommandBuilder } from 'discord.js';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// スクリプトのディレクトリを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const filePath = `${__dirname}/Normal_bob.txt`;

export const data = new SlashCommandBuilder()
  .setName('bob')
  .setDescription('BOBが返信してくれます')
  .addStringOption(option =>
    option.setName('message')
      .setDescription('BOBに言わせたいメッセージ')
      .setRequired(false) // 任意
  );

export async function execute(interaction) {
  try {
    const userMessage = interaction.options.getString("message");

    // Normal_bob.txt の内容を取得
    console.log(`Reading file from: ${filePath}`); // デバッグ用
    await fs.access(filePath);
    const textData = await fs.readFile(filePath, 'utf-8');

    // 改行で分割して配列にする
    const arr = textData.split('\n').map(line => line.trim()).filter(line => line !== '');

    if (arr.length === 0) {
      await interaction.reply('エラー: データがありません');
      return;
    }

    // ランダムに選ぶ
    const random = Math.floor(Math.random() * arr.length);
    const randomComment = arr[random];

    // 絵文字を追加する（カスタム絵文字IDは Discord中で\:emoji:と打ち込めば返る
    // 1350367513271341088 = 盾専
    const emoji = "<:custom_emoji:1350367513271341088>";

    // ユーザーがメッセージを入力した場合、それ＋ランダムメッセージ
    if (userMessage) {
      await interaction.reply(`${userMessage}\n${emoji}${randomComment}`);
    } else {
      await interaction.reply(`${emoji}${randomComment}`);
    }

  } catch (error) {
    console.error('ファイル読み込みエラー:', error);
    await interaction.reply('エラー: ファイルを読み込めませんでした');
  }
}
