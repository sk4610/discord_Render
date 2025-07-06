import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { armyNames } from '../armyname/armyname.js';
import { checkShusen } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
  .setName('coin-fire')
  .setDescription('火属性コインを集めます')
  .addStringOption(option =>
    option.setName("message")
      .setDescription("一言添える")
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const username = interaction.member.displayName;
  const player = await User.findOne({ where: { id: userId } });
  const customMessage = interaction.options.getString("message") || "";
  
  if (!player) return interaction.editReply('まず /start でチームに参加してください。');

  const army = player.army;
  const selectedElement = 'fire';
  const elementName = '火';

  const gameState = await GameState.findOne();
  if (gameState.rule_type !== 'coin') {
    return interaction.editReply('現在は属性コイン制ルールではありません。');
  }

  if (gameState.isGameOver) {
    return interaction.editReply("大戦はすでに終戦した！次回の号砲を待て！");
  }
  
  const coinColumn = `${army.toLowerCase()}_${selectedElement}_coin`;
  
  // --- コイン獲得処理（乱数表示版） ---
  const randomNum = Math.floor(Math.random() * 1000);
  const randomStr = randomNum.toString().padStart(3, '0');
  
  let acquired = 0;
  let displayMessage = `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__`;
  
  const firstDigit = Math.floor(randomNum / 100);
  const secondDigit = Math.floor((randomNum % 100) / 10);
  const thirdDigit = randomNum % 10;
  
  if (firstDigit === secondDigit && secondDigit === thirdDigit) {
    acquired = 5;
    displayMessage += `\n### 🌟 **全桁ゾロ目！大量取得！** 🌟  **${acquired}枚GET!**\n`;
  } else if (secondDigit === thirdDigit) {
    acquired = 1;
    displayMessage += `\n### ➡️ **下2桁ゾロ目！**  **${acquired}枚GET!**\n`;
  } else {
    acquired = 0;
    displayMessage += ` ➡️ ざんねん、${acquired}枚**\n`;
  }
    
  const before = gameState[coinColumn];
  gameState[coinColumn] = before + acquired;
  
  const personalCoinColumn = `personal_${selectedElement}_coin`;
  player[personalCoinColumn] += acquired;
  player.gekiha_counts += 1;
  await player.save();
  
  const after = gameState[coinColumn];
  
  let message = `-#  :military_helmet: ${armyNames[army]} ${username} の【${elementName}】コイン獲得判定！\n`;
  message += displayMessage;
  message += acquired > 0
    ? `### ${armyNames[army]}　${elementName}属性コイン ${acquired}枚獲得！(${before} → ${after}枚)\n`
    : '.\n';

  // --- スキル発動チェック ---
  const beforeMultiple = Math.floor(before / 5);
  const afterMultiple = Math.floor(after / 5);
  
  if (acquired > 0 && afterMultiple > beforeMultiple) {
    const enemyArmy = army === 'A' ? 'B' : 'A';
    const amount = after;
    
    message += `\n\n## :boom: **${armyNames[army]}の${elementName}属性スキル発動！** (${amount}枚) :boom: \n`;
    
    // 火属性スキル
    const damage = amount * 2;
    const eraseTarget = 'wood';
    message += `　🔥 燃え盛る炎: ${amount} × 2 = ${damage}ダメージ！\n`;

    // ダメージ処理
    if (army === 'A') {
      gameState.a_team_kills += damage;
    } else {
      gameState.b_team_kills += damage;
    }
    
    player.total_kills += damage;
    await player.save();

    // 敵軍の木コイン消去
    const enemyEraseColumn = `${enemyArmy.toLowerCase()}_wood_coin`;
    gameState[enemyEraseColumn] = 0;
    message += `　💨 ${armyNames[enemyArmy]}の**【木】コイン**を全て吹き飛ばした！\n`;

    await gameState.save();

    // 戦況表示（スキル発動時のみ）
    const aHP = gameState.initialArmyHP - gameState.b_team_kills;
    const bHP = gameState.initialArmyHP - gameState.a_team_kills;
    
    message += `　　➡️ ${armyNames[enemyArmy]}に **${damage} ダメージ！**\n`;
    message += `.\n-# >>> :crossed_swords:  現在の戦況:\n-# >>> :yellow_circle: ${armyNames.A} 兵力${aHP} 　|　 :green_circle: ${armyNames.B} 兵力${bHP}\n`;

    // 勝敗判定
    if (aHP <= 0 || bHP <= 0) {
      const winner = aHP <= 0 ? 'B' : 'A';
      message += `\n🎉 **${armyNames[winner]}が勝利しました！**\n`;
    }
    
    // 軍全体のコイン状況表示（スキル発動時のみ）
    const enemyArmyVar = army === 'A' ? 'B' : 'A';
    message += `-# >>> :coin: 各軍のコイン取得状況:\n`;
    message += `-# >>> 【${armyNames[army]}】`;
    message += `🔥 火: ${gameState[`${army.toLowerCase()}_fire_coin`]}枚 `;
    message += `🌲 木: ${gameState[`${army.toLowerCase()}_wood_coin`]}枚 `;
    message += `:rock: 土: ${gameState[`${army.toLowerCase()}_earth_coin`]}枚 `;
    message += `⚡ 雷: ${gameState[`${army.toLowerCase()}_thunder_coin`]}枚 `;
    message += `💧 水: ${gameState[`${army.toLowerCase()}_water_coin`]}枚\n`;
    
    message += `-# >>> 【${armyNames[enemyArmyVar]}】`;
    message += `🔥 火: ${gameState[`${enemyArmyVar.toLowerCase()}_fire_coin`]}枚 `;
    message += `🌲 木: ${gameState[`${enemyArmyVar.toLowerCase()}_wood_coin`]}枚 `;
    message += `:rock: 土: ${gameState[`${enemyArmyVar.toLowerCase()}_earth_coin`]}枚 `;
    message += `⚡ 雷: ${gameState[`${enemyArmyVar.toLowerCase()}_thunder_coin`]}枚 `;
    message += `💧 水: ${gameState[`${enemyArmyVar.toLowerCase()}_water_coin`]}枚\n`;
  } else {
    // スキル発動なしの場合は保存のみ
    await gameState.save();
  }
  
  // 個人戦績（獲得したら表示）
  if (acquired > 0){
  message += `-# >>> 🏅戦績\n-# >>> ${armyNames[army]} ${username}   行動数: **${player.gekiha_counts}回**　撃破数: **${player.total_kills}撃破**\n`;
  message += `-# >>> 個人コイン取得 →　🔥火:${player.personal_fire_coin}枚/🌲木:${player.personal_wood_coin}枚/:rock:土:${player.personal_earth_coin}枚/⚡雷:${player.personal_thunder_coin}枚/💧水:${player.personal_water_coin}枚 \n`;
  }
  
  // カスタムメッセージ
  if (customMessage) {
    message += ` \`\`\`${customMessage}\`\`\`\n`;
  }
  
  await interaction.editReply(message);
  
  // BOB支援制度（同様に簡略化）
  if (player.bobEnabled) {
    const bobId = `bob-${userId}`;
    const bobUser = await User.findOne({ where: { id: bobId } });
    
    if (bobUser) {
      // BOBの乱数判定（同じロジック）
      const bobRandomNum = Math.floor(Math.random() * 1000);
      const bobRandomStr = bobRandomNum.toString().padStart(3, '0');
      
      let bobAcquired = 0;
      let bobDisplayMessage = `### :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${bobRandomStr}__\n`;
      
      const bobFirstDigit = Math.floor(bobRandomNum / 100);
      const bobSecondDigit = Math.floor((bobRandomNum % 100) / 10);
      const bobThirdDigit = bobRandomNum % 10;
      
      if (bobFirstDigit === bobSecondDigit && bobSecondDigit === bobThirdDigit) {
        bobAcquired = 5;
        bobDisplayMessage += `### 🌟 **全桁ゾロ目！大量取得！** 🌟  **${bobAcquired}枚GET!**\n`;
      } else if (bobSecondDigit === bobThirdDigit) {
        bobAcquired = 1;
        bobDisplayMessage += `### ➡️ **下2桁ゾロ目！**  **${bobAcquired}枚GET!**\n`;
      } else {
        bobAcquired = 0;
        bobDisplayMessage += `### ➡️ **ざんねん、${bobAcquired}枚**\n`;
      }
      
      const bobBefore = gameState[coinColumn];
      gameState[coinColumn] = bobBefore + bobAcquired;
      
      bobUser[personalCoinColumn] += bobAcquired;
      bobUser.gekiha_counts += 1;
      await bobUser.save();
      
      const bobAfter = gameState[coinColumn];
      
      let bobMessage = `-#  **BOB支援制度**が発動！\n`;
      const emoji = "<:custom_emoji:1350367513271341088>";
      bobMessage += `-# ${emoji} ${armyNames[army]} ${bobUser.username} の【${elementName}】コイン獲得判定！\n`;
      bobMessage += bobDisplayMessage;
      bobMessage += bobAcquired > 0
        ? `### ${armyNames[army]}　${elementName}属性コイン ${bobAcquired}枚獲得！(${bobBefore} → ${bobAfter}枚)\n`
        : '### ざんねん！GETならず…\n';

      // BOBのスキル発動チェック
      const bobBeforeMultiple = Math.floor(bobBefore / 5);
      const bobAfterMultiple = Math.floor(bobAfter / 5);
      
      if (bobAcquired > 0 && bobAfterMultiple > bobBeforeMultiple) {
        const enemyArmy = army === 'A' ? 'B' : 'A';
        const bobAmount = bobAfter;

        bobMessage += `\n\n## :boom: **${armyNames[army]}の${elementName}属性スキル発動！（BOB）** (${bobAmount}枚) :boom: \n`;
        
        const bobDamage = bobAmount * 2;
        bobMessage += `　🔥 燃え盛る炎: ${bobAmount} × 2 = ${bobDamage}ダメージ！\n`;

        // BOBのダメージ処理
        if (army === 'A') {
          gameState.a_team_kills += bobDamage;
        } else {
          gameState.b_team_kills += bobDamage;
        }
        
        bobUser.total_kills += bobDamage;
        await bobUser.save();

        // BOBの敵軍コイン消去
        const enemyEraseColumn = `${enemyArmy.toLowerCase()}_wood_coin`;
        gameState[enemyEraseColumn] = 0;
        bobMessage += `　💨 ${armyNames[enemyArmy]}の**【木】コイン**を全て吹き飛ばした！\n`;

        await gameState.save();

        // BOBの戦況表示
        const aHP = gameState.initialArmyHP - gameState.b_team_kills;
        const bHP = gameState.initialArmyHP - gameState.a_team_kills;
        
        bobMessage += `　　➡️ ${armyNames[enemyArmy]}に **${bobDamage}** ダメージ！\n`;
        bobMessage += `.\n-# >>> :crossed_swords:  現在の戦況:\n-# >>> :yellow_circle: ${armyNames.A} 兵力${aHP} \n-# >>> :green_circle: ${armyNames.B} 兵力${bHP}\n`;
      } else {
        await gameState.save();
      }
      
      // BOBの戦績表示（常時）
      if (bobAcquired > 0){
        bobMessage += `-# >>> 🏅戦績（BOB）\n-# >>> ${armyNames[army]} ${bobUser.username}   行動数: **${bobUser.gekiha_counts}回**　撃破数: **${bobUser.total_kills}撃破**\n`;
        bobMessage += `-# >>> 個人コイン取得 →　🔥火:${bobUser.personal_fire_coin}枚/🌲木:${bobUser.personal_wood_coin}枚/:rock:土:${bobUser.personal_earth_coin}枚/⚡雷:${bobUser.personal_thunder_coin}枚/💧水:${bobUser.personal_water_coin}枚 \n`;
        
      }

      await interaction.followUp(bobMessage);
    }
  }
  
  // 終戦判定
  const loserTeam = await checkShusen();
  if (loserTeam) {
    const gameState = await GameState.findOne({ where: { id: 1 } });
    
    const totalKillsA = gameState.a_team_kills;
    const totalKillsB = gameState.b_team_kills;
    const remainingHP_A = gameState.initialArmyHP - totalKillsB;
    const remainingHP_B = gameState.initialArmyHP - totalKillsA;
    const winnerTeam = loserTeam === armyNames.A ? armyNames.B : armyNames.A;
    
    await interaction.followUp(`** 📢 ${loserTeam}の兵力が0になった。**\n# 🎖 ${winnerTeam}の勝利だ！\n\n\n\n_ **\n🏆 大戦結果:\n 【${armyNames.A}の残存兵力】${remainingHP_A} \n 【${armyNames.B}の残存兵力】${remainingHP_B}\n\n**今次大戦は終戦した！次の大戦でまた会おう！**`);
    return;
  }

  return;
}