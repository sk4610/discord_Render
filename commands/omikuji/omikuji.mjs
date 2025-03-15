import { SlashCommandBuilder } from "discord.js";

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

  
  await interaction.reply(`おみくじを引いた！」\n## 運　勢 ： ${result} ！**\n─────────────────────\n待ち人：来ず\n旅行運：スられる`);
}
