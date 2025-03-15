import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("omikuji")
  .setDescription("おみくじを引きます");

export async function execute(interaction) {
  const arr = ["魔　王", "軍　神", "百　合　神", "乙　牌", "撃　破　王", "大　吉", "吉", "中　吉", "小　吉", "も　み　吉", "抹　吉", "凶", "大　凶", "大　戦　犯"];
  const weight = [7.91, 2.09, 2, 3, 3, 4, 7, 8, 12, 12, 15, 8, 8, 8 ]; // 100%換算　魔王が7.91%で出やすくなるように
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

  // 絵文字を追加する（カスタム絵文字IDは Discord中で\:emoji:と打ち込めば返る
  // 1322580002491072653 = mao791
  // 1322580258125516953 = matcha
  // 1322730562145882122 = ee
  // 1329812204475777066 = yattane
  // 1322843082399547483 = betoman_viet
  // 1322844796091367477 = gekido
  // 1350383778643841065 = yurigami
  
  const mao = "<:custom_emoji:1322580002491072653>";
  await interaction.reply(`運　勢　：　${result} ！`);
}
