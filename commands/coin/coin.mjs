import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { armyNames } from '../armyname/armyname.js';
import { checkShusen } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
  .setName('coin')
  .setDescription('属性コインを集めます')
  .addStringOption(option =>
    option.setName('element')
      .setDescription('属性を選択')
      .setRequired(true)
      .addChoices(
        { name: '火', value: 'fire' },
        { name: '木', value: 'wood' },
        { name: '土', value: 'earth' },
        { name: '雷', value: 'thunder' },
        { name: '水', value: 'water' },
      )
  )
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
  const customMessage = interaction.options.getString("message") || ""; // メッセージ取得（デフォルトは空）
  if (!player) return interaction.editReply('まず /kaikyu でチームに参加してください。');

  const army = player.army;
  const selectedElement = interaction.options.getString('element');

  const elementNames = {
    fire: '火',
    wood: '木',
    earth: '土', 
    thunder: '雷',
    water: '水'
  };

  const elementName = elementNames[selectedElement];

  const gameState = await GameState.findOne();
  if (gameState.rule_type !== 'coin') {
    return interaction.editReply('現在は属性コイン制ルールではありません。');
  }
 
  // 大戦が終了している場合はストップ
  if (gameState.isGameOver) {
    return interaction.editReply("大戦はすでに終戦した！次回の号砲を待て！");
  }
  
  // 軍全体のコインカラム名を決定
  const coinColumn = `${army.toLowerCase()}_${selectedElement}_coin`;
  
  // --- コイン獲得処理（乱数表示版） ---
  // 3桁乱数生成（000-999）
  const randomNum = Math.floor(Math.random() * 1000);
  const randomStr = randomNum.toString().padStart(3, '0');
  
  let acquired = 0;
  let displayMessage = `### :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__\n`;
  //const roll = Math.random();
  // 下2桁を取得
  const firstDigit = Math.floor(randomNum / 100);
  const secondDigit = Math.floor((randomNum % 100) / 10);
  const thirdDigit = randomNum % 10;
  // 判定処理
  if (firstDigit === secondDigit && secondDigit === thirdDigit) {
    // 全桁ゾロ目（000-999）：5枚獲得
    acquired = 5;
    displayMessage += `### 🌟 **全桁ゾロ目！大量取得！** 🌟  **${acquired}枚GET!**\n`;
  } else if (secondDigit === thirdDigit) {
    // 下2桁ゾロ目：1枚獲得
    acquired = 1;
    displayMessage += `### ➡️ **下2桁ゾロ目！**  **${acquired}枚GET!**\n`;
  } else {
    // ハズレ
    acquired = 0;
    displayMessage += `### ➡️ **ざんねん、${acquired}枚**\n`;
  }  
    
  const before = gameState[coinColumn];
  gameState[coinColumn] = before + acquired;
  
  // 個人のコイン取得履歴も更新
  const personalCoinColumn = `personal_${selectedElement}_coin`;
  player[personalCoinColumn] += acquired;
  // 個人の書き込み回数も保存
  player.gekiha_counts += 1;
  await player.save();
  
  const after = gameState[coinColumn];
  
  let message = `-#  :military_helmet: ${armyNames[army]} ${username} の【${elementName}】コイン獲得判定！\n`;
  message += acquired > 0
    ? `### ${armyNames[army]}　${elementName}属性コイン ${acquired}枚獲得！(${before} → ${after}枚)\n`
    : '### ざんねん！GETならず…\n';

  // --- スキル発動チェック ---
  const beforeMultiple = Math.floor(before / 5);
  const afterMultiple = Math.floor(after / 5);
  
  if (acquired > 0 && afterMultiple > beforeMultiple) {
    const enemyArmy = army === 'A' ? 'B' : 'A';

    let damage = 0;
    let heal = 0;
    let eraseTarget = '';
    const amount = after; // 軍全体の総コイン数

    message += `\n\n## :boom: **${armyNames[army]}の${elementName}属性スキル発動！** (${amount}枚) :boom: \n`;

    switch (selectedElement) {
      case 'fire':
        damage = amount * 2;
        eraseTarget = 'wood';
        message += `　🔥 燃え盛る炎: ${amount} × 2 = ${damage}ダメージ！**\n`;
        break;
        
      case 'wood': {
        // A軍の兵力 = 初期HP - B軍が与えたダメージ
        // B軍の兵力 = 初期HP - A軍が与えたダメージ  
        const myHP = gameState.initialArmyHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
        const enemyHP = gameState.initialArmyHP - (army === 'A' ? gameState.a_team_kills : gameState.b_team_kills);
        
        let multiplier;
        if (myHP < enemyHP) {
          multiplier = 3;
          message += `　🌲 劣勢!反撃の木!: ${amount} × 3 = `;
        } else if (myHP > enemyHP) {
          multiplier = 1;
          message += `　🌲 優勢!とどめの木!: ${amount} × 1 = `;
        } else {
          multiplier = 2;
          message += `　🌲 均衡!加勢の木!: ${amount} × 2 = `;
        }
        damage = amount * multiplier;
        message += `${damage}ダメージ！\n`;
        eraseTarget = 'earth';
        break;
      }
      
      case 'earth': {
        const myHP = gameState.initialArmyHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
        const enemyHP = gameState.initialArmyHP - (army === 'A' ? gameState.a_team_kills : gameState.b_team_kills);
        
        let multiplier;
        if (myHP > enemyHP) {
          multiplier = 3;
          message += `　:rock: 優勢!怒れ大地!: ${amount} × 3 = `;
        } else if (myHP < enemyHP) {
          multiplier = 1;
          message += `　:rock: 劣勢!鎮まれ大地!: ${amount} × 1 = `;
        } else {
          multiplier = 2;
          message += `　:rock: 均衡!唸れ大地!: ${amount} × 2 = `;
        }
        damage = amount * multiplier;
        message += `${damage}ダメージ！\n`;
        eraseTarget = 'thunder';
        break;
      }
      
      case 'thunder': {
        const rand = Math.floor(Math.random() * 100) + 1;
        message += `　雷スキル判定: ${rand} \n`;
        if (rand % 2 === 0) {
          damage = amount * 4;
          message += `　　偶数 → ⚡ 成功！轟雷!: ${damage}ダメージ！\n`;
        } else {
          damage = 0;
          message += `　　奇数 → 発動失敗..（0ダメージ）\n`;
        }
        eraseTarget = 'water';
        break;
      }
      
      case 'water':
        damage = amount;
        heal = amount;
        message += `　💧 水の治癒!: ${damage}ダメージ + ${heal}回復！\n`;
        eraseTarget = 'fire';
        break;
    }

    // ダメージ処理
    if (damage > 0) {
      if (army === 'A') {
        gameState.a_team_kills += damage; // A軍が与えたダメージを加算
      } else {
        gameState.b_team_kills += damage; // B軍が与えたダメージを加算
      }
      
      // 個人の撃破数にも加算（ランキング用）
      player.total_kills += damage;
      await player.save();
    }

    // 回復処理（修正版：現在のHPに直接回復量を加算）
    if (heal > 0) {
      // 現在の自軍HP
      const currentMyHP = gameState.initialArmyHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
      // 回復後のHP（初期HPを超えないように制限）
      const healedHP = Math.min(currentMyHP + heal, gameState.initialArmyHP);
      // 回復分だけ受けたダメージを減らす
      const actualHeal = healedHP - currentMyHP;
      
      if (army === 'A') {
        gameState.b_team_kills = Math.max(0, gameState.b_team_kills - actualHeal);
      } else {
        gameState.a_team_kills = Math.max(0, gameState.a_team_kills - actualHeal);
      }
    }

    // 敵軍のコイン消去
    if (eraseTarget) {
      const eraseNames = {
        fire: '火', wood: '木', earth: '土', thunder: '雷', water: '水'
      };
      
      const enemyEraseColumn = `${enemyArmy.toLowerCase()}_${eraseTarget}_coin`;
      gameState[enemyEraseColumn] = 0;
      
      message += `　💨 ${armyNames[enemyArmy]}の**【${eraseNames[eraseTarget]}】コイン**を全て吹き飛ばした！\n`;
    }

    await gameState.save();

    // 戦況表示（修正版）
    const aHP = gameState.initialArmyHP - gameState.b_team_kills;
    const bHP = gameState.initialArmyHP - gameState.a_team_kills;
    
    if (damage > 0) message += `### 　　➡️ ${armyNames[enemyArmy]}に **${damage} ダメージ！**\n`;
    if (heal > 0) message += `### 　　➡️ :chocolate_bar: ${armyNames[army]}の兵力が **${heal} 回復！**\n`;

    // 勝敗判定
    if (aHP <= 0 || bHP <= 0) {
      const winner = aHP <= 0 ? 'B' : 'A';
      message += `\n🎉 **${armyNames[winner]}が勝利しました！**\n`;
    }
    message += `.`;
    message += `\n-# >>> :crossed_swords:  現在の戦況:\n-# >>> :yellow_circle: ${armyNames.A} 兵力${aHP} 　|　 :green_circle: ${armyNames.B} 兵力${bHP}\n`;

    //   console.log(`[DEBUG] ${army}軍 ${selectedElement}スキル: before=${before}, after=${after}, damage=${damage}, heal=${heal}`);

  } else {
    // スキル発動なしの場合も戦況表示
    await gameState.save(); // コイン獲得だけでも保存
    // 戦況表示（スキル発動なしでも表示）
    const aHP = gameState.initialArmyHP - gameState.b_team_kills;
    const bHP = gameState.initialArmyHP - gameState.a_team_kills;
    message += `.`;
    message += `\n-# >>> :crossed_swords:  現在の戦況:\n-# >>> :yellow_circle: ${armyNames.A} 兵力${aHP} 　|　 :green_circle: ${armyNames.B} 兵力${bHP}\n`; 
  }
  //個人戦績
  //message += `-# >>> -\n`;
  message += `-# >>> 🏅戦績\n-# >>> ${armyNames[army]} ${username}   行動数: **${player.gekiha_counts}回**　撃破数: **${player.total_kills} 撃破**\n`;
  message += `-# >>> 個人コイン取得 →　火:${player.personal_fire_coin}枚/木:${player.personal_wood_coin}枚/土:${player.personal_earth_coin}枚/雷:${player.personal_thunder_coin}枚/水:${player.personal_water_coin}枚 \n` ;
  // 軍全体のコイン状況表示（自軍 + 敵軍）
  const enemyArmy = army === 'A' ? 'B' : 'A';
  
  //message += `-# >>> -\n`;
  message += `-# >>> :coin: 各軍のコイン取得状況:\n`;
  message += `-# >>> 【${armyNames[army]}】`;
  message += `🔥 火: ${gameState[`${army.toLowerCase()}_fire_coin`]}枚 `;
  message += `🌲 木: ${gameState[`${army.toLowerCase()}_wood_coin`]}枚 `;
  message += `:rock: 土: ${gameState[`${army.toLowerCase()}_earth_coin`]}枚 `;
  message += `⚡ 雷: ${gameState[`${army.toLowerCase()}_thunder_coin`]}枚 `;
  message += `💧 水: ${gameState[`${army.toLowerCase()}_water_coin`]}枚\n`;
  
  message += `-# >>> 【${armyNames[enemyArmy]}】`;
  message += `🔥 火: ${gameState[`${enemyArmy.toLowerCase()}_fire_coin`]}枚 `;
  message += `🌲 木: ${gameState[`${enemyArmy.toLowerCase()}_wood_coin`]}枚 `;
  message += `:rock: 土: ${gameState[`${enemyArmy.toLowerCase()}_earth_coin`]}枚 `;
  message += `⚡ 雷: ${gameState[`${enemyArmy.toLowerCase()}_thunder_coin`]}枚 `;
  message += `💧 水: ${gameState[`${enemyArmy.toLowerCase()}_water_coin`]}枚\n`;

  // メッセージ（ユーザーが入力したもの）
  if (customMessage) {
      message += ` \`\`\`${customMessage}\`\`\`\n`;
  }
  
  // 通常のメッセージを送信
  await interaction.editReply(message);
  
  
  // BOB支援制度の処理を追加
  // 都合、処理はプレイヤーとBOBで2回回すことになる
  if (player.bobEnabled) {
    const bobId = `bob-${userId}`;
    const bobUser = await User.findOne({ where: { id: bobId } });
    
    if (bobUser) {
      // BOBのコイン獲得判定
      let bobAcquired = 0;
      const bobRoll = Math.random();
      
      if (bobRoll < 0.01) {
        bobAcquired = 5; // 1%で5枚
      } else if (bobRoll < 0.11) {
        bobAcquired = 1; // 10%で1枚
      }
      
      // BOBの軍全体コイン更新
      const bobBefore = gameState[coinColumn];
      gameState[coinColumn] = bobBefore + bobAcquired;
      
      // BOBの個人コイン履歴更新
      bobUser[personalCoinColumn] += bobAcquired;
      bobUser.gekiha_counts += 1;
      await bobUser.save();
      
      const bobAfter = gameState[coinColumn];
      
      let bobMessage = `-#  **BOB支援制度**が発動！\n`;
      const emoji = "<:custom_emoji:1350367513271341088>";
      bobMessage += `-# ${emoji} ${armyNames[army]} ${bobUser.username} の【${elementName}】コイン獲得判定！\n`;
      bobMessage += bobAcquired > 0
        ? `### ${armyNames[army]}　${elementName}属性コイン ${bobAcquired}枚獲得！(${bobBefore} → ${bobAfter}枚)\n`
        : '### ざんねん！獲得ならず…\n';

      // BOBのスキル発動チェック
      const bobBeforeMultiple = Math.floor(bobBefore / 5);
      const bobAfterMultiple = Math.floor(bobAfter / 5);
      
      if (bobAcquired > 0 && bobAfterMultiple > bobBeforeMultiple) {
        const enemyArmy = army === 'A' ? 'B' : 'A';

        let bobDamage = 0;
        let bobHeal = 0;
        let bobEraseTarget = '';
        const bobAmount = bobAfter;

        bobMessage += `\n\n## :boom: **${armyNames[army]}の${elementName}属性スキル発動！（BOB）** (${bobAmount}枚) :boom: \n`;

        switch (selectedElement) {
          case 'fire':
            bobDamage = bobAmount * 2;
            bobEraseTarget = 'wood';
            bobMessage += `　🔥 燃え盛る炎: ${bobAmount} × 2 = ${bobDamage}ダメージ！\n`;
            break;
            
          case 'wood': {
            const myHP = gameState.initialArmyHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
            const enemyHP = gameState.initialArmyHP - (army === 'A' ? gameState.a_team_kills : gameState.b_team_kills);
            
            let multiplier;
            if (myHP < enemyHP) {
              multiplier = 3;
              bobMessage += `　🌲 劣勢!反撃の木!: ${bobAmount} × 3 = `;
            } else if (myHP > enemyHP) {
              multiplier = 1;
              bobMessage += `　🌲 優勢!とどめの木!: ${bobAmount} × 1 = `;
            } else {
              multiplier = 2;
              bobMessage += `　🌲 均衡!加勢の木!: ${bobAmount} × 2 = `;
            }
            bobDamage = bobAmount * multiplier;
            bobMessage += `${bobDamage}ダメージ！\n`;
            bobEraseTarget = 'earth';
            break;
          }
          
          case 'earth': {
            const myHP = gameState.initialArmyHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
            const enemyHP = gameState.initialArmyHP - (army === 'A' ? gameState.a_team_kills : gameState.b_team_kills);
            
            let multiplier;
            if (myHP > enemyHP) {
              multiplier = 3;
              bobMessage += `　:rock: 優勢!怒れ大地!: ${bobAmount} × 3 = `;
            } else if (myHP < enemyHP) {
              multiplier = 1;
              bobMessage += `　:rock: 劣勢!鎮まれ大地!: ${bobAmount} × 1 = `;
            } else {
              multiplier = 2;
              bobMessage += `　:rock: 均衡!唸れ大地!: ${bobAmount} × 2 = `;
            }
            bobDamage = bobAmount * multiplier;
            bobMessage += `${bobDamage}ダメージ！\n`;
            bobEraseTarget = 'thunder';
            break;
          }
          
          case 'thunder': {
            const rand = Math.floor(Math.random() * 100) + 1;
            bobMessage += `　雷スキル判定: ${rand} \n`;
            if (rand % 2 === 0) {
              bobDamage = bobAmount * 4;
              bobMessage += `　　偶数 → ⚡ 成功！轟雷!: ${bobDamage}ダメージ！\n`;
            } else {
              bobDamage = 0;
              bobMessage += `　　奇数 → 発動失敗..（0ダメージ）\n`;
            }
            bobEraseTarget = 'water';
            break;
          }
          
          case 'water':
            bobDamage = bobAmount;
            bobHeal = bobAmount;
            bobMessage += `　💧 水の治癒!: ${bobDamage}ダメージ + ${bobHeal}回復！\n`;
            bobEraseTarget = 'fire';
            break;
        }

        // BOBのダメージ処理
        if (bobDamage > 0) {
          if (army === 'A') {
            gameState.a_team_kills += bobDamage;
          } else {
            gameState.b_team_kills += bobDamage;
          }
          
          bobUser.total_kills += bobDamage;
          await bobUser.save();
        }

        // BOBの回復処理
        if (bobHeal > 0) {
          const currentMyHP = gameState.initialArmyHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
          const healedHP = Math.min(currentMyHP + bobHeal, gameState.initialArmyHP);
          const actualHeal = healedHP - currentMyHP;
          
          if (army === 'A') {
            gameState.b_team_kills = Math.max(0, gameState.b_team_kills - actualHeal);
          } else {
            gameState.a_team_kills = Math.max(0, gameState.a_team_kills - actualHeal);
          }
        }

        // BOBの敵軍コイン消去
        if (bobEraseTarget) {
          const eraseNames = {
            fire: '火', wood: '木', earth: '土', thunder: '雷', water: '水'
          };
          
          const enemyEraseColumn = `${enemyArmy.toLowerCase()}_${bobEraseTarget}_coin`;
          gameState[enemyEraseColumn] = 0;
          
          bobMessage += `　💨 ${armyNames[enemyArmy]}の**【${eraseNames[bobEraseTarget]}】コイン**を全て吹き飛ばした！\n`;
        }

        await gameState.save();

        // BOBの戦況表示
        const aHP = gameState.initialArmyHP - gameState.b_team_kills;
        const bHP = gameState.initialArmyHP - gameState.a_team_kills;
        
        if (bobDamage > 0) bobMessage += `　　➡️ ${armyNames[enemyArmy]}に **${bobDamage}** ダメージ！\n`;
        if (bobHeal > 0) bobMessage += `　　➡️ :chocolate_bar: ${armyNames[army]}の兵力が **${bobHeal}** 回復！\n`;

        bobMessage += `.\n`;
        bobMessage += `-# >>> :crossed_swords:  現在の戦況:\n-# >>> :yellow_circle: ${armyNames.A} 兵力${aHP} \n-# >>> :green_circle: ${armyNames.B} 兵力${bHP}\n`;

      } else {
        // BOBのスキル発動なしの場合も戦況表示
        await gameState.save();
        const aHP = gameState.initialArmyHP - gameState.b_team_kills;
        const bHP = gameState.initialArmyHP - gameState.a_team_kills;
        bobMessage += `.\n`;
        bobMessage += `-# >>> :crossed_swords:  現在の戦況:\n-# >>> :yellow_circle: ${armyNames.A} 兵力${aHP} 　|　 :green_circle: ${armyNames.B} 兵力${bHP}\n`; 
      }
      
      // BOBの戦績表示
      bobMessage += `-# >>> 🏅戦績（BOB）\n-# >>> ${armyNames[army]} ${bobUser.username}   行動数: **${bobUser.gekiha_counts}回**　撃破数: **${bobUser.total_kills}撃破**\n`;
      bobMessage += `-# >>> 個人コイン取得 →　火:${bobUser.personal_fire_coin}枚/木:${bobUser.personal_wood_coin}枚/土:${bobUser.personal_earth_coin}枚/雷:${bobUser.personal_thunder_coin}枚/水:${bobUser.personal_water_coin}枚 \n`;
      
      // BOBの軍全体コイン状況表示
      const enemyArmy = army === 'A' ? 'B' : 'A';
      
      bobMessage += `-# >>> :coin: 各軍のコイン取得状況:\n`;
      bobMessage += `-# >>> 【${armyNames[army]}】`;
      bobMessage += `🔥 火: ${gameState[`${army.toLowerCase()}_fire_coin`]}枚 `;
      bobMessage += `🌲 木: ${gameState[`${army.toLowerCase()}_wood_coin`]}枚 `;
      bobMessage += `:rock: 土: ${gameState[`${army.toLowerCase()}_earth_coin`]}枚 `;
      bobMessage += `⚡ 雷: ${gameState[`${army.toLowerCase()}_thunder_coin`]}枚 `;
      bobMessage += `💧 水: ${gameState[`${army.toLowerCase()}_water_coin`]}枚\n`;
      
      bobMessage += `-# >>> 【${armyNames[enemyArmy]}】`;
      bobMessage += `🔥 火: ${gameState[`${enemyArmy.toLowerCase()}_fire_coin`]}枚 `;
      bobMessage += `🌲 木: ${gameState[`${enemyArmy.toLowerCase()}_wood_coin`]}枚 `;
      bobMessage += `:rock: 土: ${gameState[`${enemyArmy.toLowerCase()}_earth_coin`]}枚 `;
      bobMessage += `⚡ 雷: ${gameState[`${enemyArmy.toLowerCase()}_thunder_coin`]}枚 `;
      bobMessage += `💧 水: ${gameState[`${enemyArmy.toLowerCase()}_water_coin`]}枚`;

      await interaction.followUp(bobMessage);
    }
  }
  
  
  
  
  // 終戦判定（メッセージ送信後に別途通知）
  const loserTeam = await checkShusen();
  if (loserTeam) {
    const gameState = await GameState.findOne({ where: { id: 1 } });
    
    // 残存兵力チェック
    const totalKillsA = gameState.a_team_kills;
    const totalKillsB = gameState.b_team_kills;
    
    const remainingHP_A = gameState.initialArmyHP - totalKillsB;
    const remainingHP_B = gameState.initialArmyHP - totalKillsA;
    
    const winnerTeam = loserTeam === armyNames.A ? armyNames.B : armyNames.A;
    
    // 終戦時の自動通知（別メッセージで送信）
    await interaction.followUp(`** 📢 ${loserTeam}の兵力が0になった。**\n# 🎖 ${winnerTeam}の勝利だ！\n\n\n\n_ **\n🏆 大戦結果:\n 【${armyNames.A}の残存兵力】${remainingHP_A} \n 【${armyNames.B}の残存兵力】${remainingHP_B}\n\n**今次大戦は終戦した！次の大戦でまた会おう！**`);
    return;
  }  
  return;
}