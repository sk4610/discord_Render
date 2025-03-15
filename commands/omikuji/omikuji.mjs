import { SlashCommandBuilder } from "discord.js";
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// スクリプトのディレクトリを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const filePath_gunshin1 = `${__dirname}/comment1_gunshin.txt`;
const filePath_gunshin2 = `${__dirname}/comment2_gunshin.txt`;
const filePath_gunshin3 = `${__dirname}/comment3_gunshin.txt`;


export const data = new SlashCommandBuilder()
  .setName("omikuji")
  .setDescription("おみくじを引きます");

export async function execute(interaction) {
  const arr = ["魔　王", "軍　神", "百　合　神", "乙　牌", "撃　破　王", "大　吉", "吉", "ネ　ギ　吉", "も　み　吉", "抹　吉", "凶", "大　凶", "大　戦　犯"];
  const weight = [7.91, 2.09, 2, 3, 3, 4, 7, 16, 17, 17, 8, 7, 6 ]; // 100%換算　魔王が7.91%で出やすくなるように
  let result = "";

  let totalWeight = 0;
  for (let i = 0; i < weight.length; i++) {
    totalWeight += weight[i];
  }
  let random = Math.floor(Math.random() * totalWeight);
  
  for (let i = 0; i < weight.length; i++) {
    if (random < weight[i]) {
      result = arr[i];
      break;
    } else {
      random -= weight[i];
    }
  }


    // これよりおみくじのコメント分け　comment1 = 待人、旅行運　comment2=撃破運　comment3=雀運
    if (result === "魔　王") {
      // ファイルが存在するかチェック
      await fs.access(filePath_gunshin1);
      await fs.access(filePath_gunshin2);
      await fs.access(filePath_gunshin3);
      // ファイルを読み込む（非同期処理）
      const textData = await fs.readFile(filePath_gunshin1, 'utf-8');
      const textData2 = await fs.readFile(filePath_gunshin2, 'utf-8');
      const textData3 = await fs.readFile(filePath_gunshin3, 'utf-8'); 
    　// 改行で分割して配列arrにする
      const arr1 = textData.split('\n').map(line => line.trim()).filter(line => line !== '');
      const arr2 = textData2.split('\n').map(line => line.trim()).filter(line => line !== '');
      const arr3 = textData3.split('\n').map(line => line.trim()).filter(line => line !== '');
        if (arr1.length === 0) {
        await interaction.reply('エラー: データがありません');
        return;
      } else if (arr2.length === 0) {
        await interaction.reply('エラー: データがありません');
        return;
      }else if (arr3.length === 0) {
        await interaction.reply('エラー: データがありません');
        return;
      }
      // ランダムに選ぶ
      const random1 = Math.floor(Math.random() * arr.length);
      const comment1 = arr1[random1];
      const random2 = Math.floor(Math.random() * arr.length);
      const comment2 = arr2[random2];
      const random3 = Math.floor(Math.random() * arr.length);
      const comment3 = arr3[random3];

  
  // 絵文字を追加する（カスタム絵文字IDは Discord中で\:emoji:と打ち込めば返る
  // 1322580002491072653 = mao791
  // 1322580258125516953 = matcha
  // 1322730562145882122 = ee
  // 1329812204475777066 = yattane
  // 1322843082399547483 = betoman_viet
  // 1322844796091367477 = gekido
  // 1350383778643841065 = yurigami
  // 1322826267187478549 = gj
  // 1322583560938590238 = negi
  // 1322582345445937203 = sambow
  const mao = "<:custom_emoji:1322580002491072653>"; // 魔王
  const gunshin = "<:custom_emoji:1322826267187478549>"; //軍神 
  const yurigami = "<:custom_emoji:1350383778643841065>"; //百合神
  const otsupai = "<:custom_emoji:1322843082399547483>"; // 乙牌
  const lucky = "<:custom_emoji:1329812204475777066>"; // 大吉、撃破王、吉
  const negi = "<:custom_emoji:1322583560938590238>"; // ネギ吉
  const sambow = "<:custom_emoji:1322582345445937203>"; // もみ吉
  const matcha = "<:custom_emoji:1322580258125516953>"; // 抹吉
  const unlucky = "<:custom_emoji:1322730562145882122>"; // 凶、大凶
  const senpan = "<:custom_emoji:1322844796091367477>"; // 大戦犯

  
  await interaction.reply(`${interaction.member.displayName}はおみくじを引いた！\n\n───────────────────────────\n## 運　勢 ： ${gunshin}${result} ！\n───────────────────────────\n\n◯${comment2}\n◯${comment3}`);
}
