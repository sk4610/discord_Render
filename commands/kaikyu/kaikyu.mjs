import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { armyNames } from '../armyname/armyname.js';
//以下はStart_bob.txtを読ませるためのパス設定
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// スクリプトのディレクトリを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const filePath = `${__dirname}/Start_bob.txt`;

const ranks = ['二等兵＝', '一等兵〓', '軍曹¶', '曹長†', '大尉‡', '大佐▽', '准将◇', '大将Θ', '元帥☆'];
const weight = [28, 24, 20, 13, 8, 4, 1.5, 1, 0.5 ]; // VIP 大文字の数の確率順を基に100％になるように微調整

//**階級制処理の流れ**
// rule.mjs /ruleで rule_typeをname:階級制, value:rankedに設定
// 次にkaikyu.mjs(ここ) /kaikyuで userの所属軍、階級をランダムに割当（所属軍はユーザ選択）
// 次にgekiha.mjs /gekihaで　階級制の撃破判定処理を実行　ただし実際に階級制の処理をしているのはkaikyu_main.js
// gekiha.mjs内で rule_typeが階級制の時に、kaikyu_main.jsの中身を実行する流れになっている


export const data = new SlashCommandBuilder()
  .setName('kaikyu')
  .setDescription('軍を選択し、ランダムな階級を割り当てます')
  .addStringOption(option =>
    option.setName('army')
      .setDescription('所属する軍を選択')
      .setRequired(true)
      .addChoices(
        { name: armyNames.A, value: 'A' },
        { name: armyNames.B, value: 'B' }
      ));

// gekiha.mjsで軍名を表示するためのグローバル関数の設定　変更をkaikyu.mjsだけで留める
// 正直なところarmyNamesを使えばいいのだが、先にこのgetArymyNameを作ったので変更するのが面倒なため階級制ではこのまま運用する
export const armyName_global = {A:armyNames.A,B:armyNames.B};
export function getArmyName(army) {
  return armyName_global[army] || '不明';
}

export async function execute(interaction) {
  const army = interaction.options.getString('army');
  const userId = interaction.user.id;
  const username = interaction.member.displayName;
    // army の値に対応する軍名を取得
  const armyName = army === 'A' ? armyNames.A : armyNames.B;
  
  try {
    // ルールが設定されているか確認
    const gameState = await GameState.findByPk(1);
    if (!gameState || !gameState.rule_set) {
      return await interaction.reply('エラー: まず /rule コマンドでルールを設定してください。');
    }

    // すでに登録済みか確認
    const existingPlayer = await User.findOne({ where: { id: userId }, raw: true});
    if (existingPlayer) {
      const existingArmyName = existingPlayer.army === 'A' ? armyNames.A : armyNames.B;
      return await interaction.reply(`エラー: あなたはすでに **${existingArmyName}** の **${existingPlayer.rank}** です！`);
    }

    // ランダムな階級を決定
//    const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
//    const randomRank = result;

    // ここでランダムな階級を決定
    let totalWeight = weight.reduce((sum, w) => sum + w, 0);
    let random = Math.floor(Math.random() * totalWeight);
    let randomRank = '';
    for (let i = 0; i < weight.length; i++) {
      if (random < weight[i]) {
        randomRank = ranks[i]; // ランダムに選ばれた階級
        break;
      } else {
        random -= weight[i];
      }
    }
    
    // データベースにプレイヤーを追加
    await User.create({ id: userId, username, army, rank: randomRank, total_kills: 0 });

    await interaction.reply(`${username} さんが **${armyName}** に配属され、**${randomRank}** になりました！`);
    
    
   // ---- 👇 BOB支援制度が有効な場合、BOBの階級も登録 ----
    if (existingPlayer.bobEnabled) {
      const bobId = `bob-${userId}`; // BOBのIDはユーザーIDに紐付けて区別
      const existingBOB = await User.findOne({ where: { id: bobId }, raw: true });
      const bobname = `BOB - ${username}のパートナー`;
            
      if (!existingBOB) {
        // BOBにもランダムな階級を割り当てる
        let bobRandom = Math.floor(Math.random() * totalWeight);
        let bobRank = '';
        for (let i = 0; i < weight.length; i++) {
          if (bobRandom < weight[i]) {
            bobRank = ranks[i];
            break;
          } else {
            bobRandom -= weight[i];
          }
        }

        await User.create({ id: bobId, username: bobname, army: army, rank: bobRank, total_kills: 0 });

        await interaction.followUp(` あなたの支援兵 **BOB** ${bobname}も **${bobRank}** で **${armyName}** に配属されました！`);
      }
    }
  } catch (error) {
    console.error('軍配属エラー:', error);
    await interaction.reply('エラー: 軍の選択に失敗しました');
  }
}
