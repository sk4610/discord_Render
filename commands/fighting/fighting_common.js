import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { getArmyNames } from '../armyname/armyname.js';
import { checkShusen } from '../taisen/game.js';

// ファイティング制共通処理
async function executeFightingAction(interaction, actionType, targetUsername = null) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const username = interaction.member.displayName;
  const player = await User.findOne({ where: { id: userId } });
  const customMessage = interaction.options.getString("message") || "";
  
  if (!player) {
    return await interaction.editReply('まず /start でチームに参加してください。');
  }

  const army = player.army;
  const gameState = await GameState.findOne();
  const armyNames = await getArmyNames();
  
  if (gameState.rule_type !== 'fighting') {
    return await interaction.editReply('現在はファイティング制ルールではありません。');
  }

  if (gameState.isGameOver) {
    return await interaction.editReply("大戦はすでに終戦した！次回の号砲を待て！");
  }
  
  try {
    // ファイト値の初期化チェック
    if (!player.fight_value || player.fight_value < 1) {
      await player.update({ fight_value: 1 });
    }
    
    // ジャッジナンバー生成
    const randomNum = Math.floor(Math.random() * 100);
    const randomStr = randomNum.toString().padStart(2, '0');
    
    let message = `-#  :military_helmet: ${armyNames[army]} ${username} の行動判定！\n`;
    message += `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__**`;
    
    const isMultipleOf10 = randomNum % 10 === 0;
    const isZorome = Math.floor(randomNum / 10) === randomNum % 10;
    
    let totalDamage = 0;
    let actionMessage = '';
    
    // 10の倍数判定
    if (isMultipleOf10) {
      totalDamage += 1;
      actionMessage += `** ⚡ 10の倍数！** 敵軍に1ダメージ！\n`;
    }
    
    // ゾロ目判定
    if (isZorome) {
      if (actionType === 'charge') {
        // /charge のゾロ目処理
        if (randomNum <= 44) {
          const oldFight = player.fight_value;
          const newFight = oldFight * 2;
          await player.update({ fight_value: newFight });
          actionMessage += `** 🔥 チャージ成功！** ファイト値が ${oldFight} → ${newFight} に**2倍！**\n`;
        } else {
          const oldFight = player.fight_value;
          const newFight = oldFight + 1;
          await player.update({ fight_value: newFight });
          actionMessage += `** 💪 チャージ成功！** ファイト値が ${oldFight} → ${newFight} に**+1！**\n`;
        }
      } else if (actionType === 'punch') {
        // /punch のゾロ目処理
        const enemyArmy = army === 'A' ? 'B' : 'A';
        const targetPlayer = await User.findOne({ 
          where: { 
            username: targetUsername,
            army: enemyArmy 
          } 
        });
        
        if (!targetPlayer) {
          actionMessage += ` ❌ **対象が見つかりません** ${targetUsername}は敵軍にいません\n`;
        } else {
          const oldTargetFight = targetPlayer.fight_value || 1;
          
          if (randomNum <= 22) {
            await targetPlayer.update({ fight_value: 1 });
            actionMessage += `** 💥 クリティカルパンチ！** ${targetUsername}のファイト値を **1 にリセット！**\n`;
          } else {
            const newTargetFight = Math.max(1, oldTargetFight - 1);
            await targetPlayer.update({ fight_value: newTargetFight });
            actionMessage += `** 👊 **パンチ成功！** ${targetUsername}のファイト値を ${oldTargetFight} → ${newTargetFight} に-1！\n`;
          }
        }
      } else if (actionType === 'burst') {
        // /burst のゾロ目処理
        if (randomNum === 0) {
          const burstDamage = player.fight_value * 2;
          totalDamage += burstDamage;
          actionMessage += `** 💣 スーパーバースト！** 敵軍に **${burstDamage}ダメージ** (ファイト×2)！\n`;
        } else {
          const burstDamage = player.fight_value;
          totalDamage += burstDamage;
          actionMessage += `** 🌟 バースト成功！** 敵軍に **${burstDamage}ダメージ** (ファイト×1)！\n`;
        }
      }
    } else if (!isMultipleOf10) {
      // ハズレ
      actionMessage += ` → ざんねん、ハズレ...\n`;
    }
    
    message += actionMessage;
    
    // ダメージ適用
    if (totalDamage > 0) {
      if (army === 'A') {
        gameState.a_team_kills += totalDamage;
      } else {
        gameState.b_team_kills += totalDamage;
      }
      player.total_kills += totalDamage;
    }
    
    // 行動回数更新
    player.gekiha_counts += 1;
    await player.save();
    await gameState.save();
    
    // 戦況表示（ダメージ時のみ）
    if (totalDamage > 0) {
      const aHP = gameState.initialArmyHP - gameState.b_team_kills;
      const bHP = gameState.initialArmyHP - gameState.a_team_kills;
      message += `-# >>> :crossed_swords: 現在の戦況: ${armyNames.A} ${aHP} vs ${armyNames.B} ${bHP}\n`;
      message += `-# >>> 🏅戦績: ${armyNames[army]} ${username} 行動数: **${player.gekiha_counts}回** 撃破数: **${player.total_kills}撃破**\n`;
    }
    
    // ファイト値表示（常時）
    message += `-# >>> 💪 あなたのファイト値: **${player.fight_value}**\n`;
    
    // カスタムメッセージ
    if (customMessage) {
      message += `\`\`\`${customMessage}\`\`\`\n`;
    }
    
    await interaction.editReply(message);
    
    // BOB支援制度（省略版 - 必要に応じて追加）
    
    // 終戦判定
    const loserTeam = await checkShusen();
    if (loserTeam) {
      const finalGameState = await GameState.findOne({ where: { id: 1 } });
      const totalKillsA = finalGameState.a_team_kills;
      const totalKillsB = finalGameState.b_team_kills;
      const remainingHP_A = finalGameState.initialArmyHP - totalKillsB;
      const remainingHP_B = finalGameState.initialArmyHP - totalKillsA;
      const winnerTeam = loserTeam === armyNames.A ? armyNames.B : armyNames.A;
      
      await interaction.followUp(`** 📢 ${loserTeam}の兵力が0になった。**\n# 🎖 ${winnerTeam}の勝利だ！\n\n🏆 大戦結果:\n 【${armyNames.A}の残存兵力】${remainingHP_A} \n 【${armyNames.B}の残存兵力】${remainingHP_B}\n\n**今次大戦は終戦した！次の大戦でまた会おう！**`);
      return;
    }
    
  } catch (error) {
    console.error('ファイティング制処理エラー:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply('エラー: ファイティング制処理に失敗しました');
    } else if (interaction.deferred) {
      await interaction.editReply('エラー: ファイティング制処理に失敗しました');
    }
  }
}

export { executeFightingAction };