import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { armyNames } from '../armyname/armyname.js';
import { checkShusen } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
  .setName('beast')
  .setDescription('ビーストと共に戦います')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('ビーストの名前（初回のみ）')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName("message")
      .setDescription("一言添える")
      .setRequired(false)
  );

// ATK判定関数
function determineATK(lastDigit) {
  if ([0, 1, 2, 3].includes(lastDigit)) return 0;
  if ([4, 5, 6].includes(lastDigit)) return 1;
  if ([7, 8].includes(lastDigit)) return 2;
  if ([9].includes(lastDigit)) return 3;
}

// 行動判定関数
function processBeastAction(randomNum) {
  const lastTwoDigits = randomNum % 100;
  const secondDigit = Math.floor((randomNum % 100) / 10);
  const thirdDigit = randomNum % 10;
  const firstDigit = Math.floor(randomNum / 100);
  
  // 全桁ゾロ目チェック
  const isAllSame = (firstDigit === secondDigit && secondDigit === thirdDigit && randomNum !== 0);
  
  if (isAllSame) {
    return { type: 'beast_break', kills: 0, atkUp: 0, message: '🌟 ビーストブレイク発動！' };
  } else if (lastTwoDigits % 10 === 0 && lastTwoDigits !== 0) {
    return { type: 'feed', kills: 0, atkUp: 1, message: '🍖 餌やり成功！ATK+1' };
  } else if (secondDigit === thirdDigit) {
    return { type: 'kill', kills: 1, atkUp: 0, message: '⚡ 下2桁ゾロ目！1撃破' };
  } else {
    return { type: 'miss', kills: 0, atkUp: 0, message: '💥 ハズレ...' };
  }
}

// ビーストブレイク処理
async function executeBeastBreak(playerArmy) {
  const enemyArmy = playerArmy === 'A' ? 'B' : 'A';
  
  // 敵軍の最高ATKを取得
  const maxAtkBeast = await User.findOne({
    where: { army: enemyArmy, beast_is_active: true },
    order: [['beast_atk', 'DESC']]
  });
  
  if (!maxAtkBeast) return '敵軍にアクティブなビーストがいません';
  
  const maxAtk = maxAtkBeast.beast_atk;
  
  // 該当ビーストを全て戦闘不能に
  const affectedBeasts = await User.findAll({
    where: { army: enemyArmy, beast_atk: maxAtk, beast_is_active: true }
  });
  
  await User.update(
    { beast_is_active: false },
    { where: { army: enemyArmy, beast_atk: maxAtk, beast_is_active: true }}
  );
  
  const beastNames = affectedBeasts.map(b => b.beast_name || 'unnamed').join(', ');
  return `💀 ${armyNames[enemyArmy]}のATK${maxAtk}ビースト（${beastNames}）を全て戦闘不能にした！`;
}

// 決闘システム
async function executeBeastDuel(interaction) {
  const gameState = await GameState.findOne();
  const totalActions = await User.sum('gekiha_counts');
  const currentRound = Math.floor(totalActions / gameState.duel_interval);
  
  // 餌やり済みビーストを取得
  const eligibleBeasts = await User.findAll({
    where: { beast_has_fed: true, beast_is_active: true },
    order: [['last_action_time', 'DESC']]
  });
  
  const armyA = eligibleBeasts.filter(b => b.army === 'A');
  const armyB = eligibleBeasts.filter(b => b.army === 'B');
  
  let duelMessage = `\n🏟️ **第${currentRound + 1}回 ビースト決闘開始！** 🏟️\n\n`;
  
  const minLength = Math.min(armyA.length, armyB.length);
  let totalDamageA = 0;
  let totalDamageB = 0;
  
  // 1vs1マッチング
  for (let i = 0; i < minLength; i++) {
    const beastA = armyA[i];
    const beastB = armyB[i];
    
    let result;
    if (beastA.beast_atk > beastB.beast_atk) {
      const damage = beastA.beast_atk - beastB.beast_atk;
      totalDamageB += damage;
      beastB.beast_is_active = false;
      await beastB.save();
      result = `⚔️ ${beastA.beast_name || 'Unnamed'}(ATK${beastA.beast_atk}) vs ${beastB.beast_name || 'Unnamed'}(ATK${beastB.beast_atk}) → ${armyNames.A}勝利！ダメージ${damage}`;
    } else if (beastB.beast_atk > beastA.beast_atk) {
      const damage = beastB.beast_atk - beastA.beast_atk;
      totalDamageA += damage;
      beastA.beast_is_active = false;
      await beastA.save();
      result = `⚔️ ${beastA.beast_name || 'Unnamed'}(ATK${beastA.beast_atk}) vs ${beastB.beast_name || 'Unnamed'}(ATK${beastB.beast_atk}) → ${armyNames.B}勝利！ダメージ${damage}`;
    } else {
      beastA.beast_is_active = false;
      beastB.beast_is_active = false;
      await beastA.save();
      await beastB.save();
      result = `⚔️ ${beastA.beast_name || 'Unnamed'}(ATK${beastA.beast_atk}) vs ${beastB.beast_name || 'Unnamed'}(ATK${beastB.beast_atk}) → 相打ち！`;
    }
    
    duelMessage += result + '\n';
  }
  
  // 余ったビーストの処理
  const remainingA = armyA.slice(minLength);
  const remainingB = armyB.slice(minLength);
  
  for (const beast of remainingA) {
    totalDamageB += beast.beast_atk;
    duelMessage += `🐾 ${beast.beast_name || 'Unnamed'}(ATK${beast.beast_atk}) → ${armyNames.B}に${beast.beast_atk}ダメージ\n`;
  }
  
  for (const beast of remainingB) {
    totalDamageA += beast.beast_atk;
    duelMessage += `🐾 ${beast.beast_name || 'Unnamed'}(ATK${beast.beast_atk}) → ${armyNames.A}に${beast.beast_atk}ダメージ\n`;
  }
  
  // ダメージ適用
  if (totalDamageA > 0) {
    gameState.b_team_kills += totalDamageA;
  }
  if (totalDamageB > 0) {
    gameState.a_team_kills += totalDamageB;
  }
  
  await gameState.save();
  
  // 戦況表示
  const aHP = gameState.initialArmyHP - gameState.b_team_kills;
  const bHP = gameState.initialArmyHP - gameState.a_team_kills;
  
  duelMessage += `\n💥 **決闘結果**\n`;
  duelMessage += `${armyNames.A}への被害: ${totalDamageA}\n`;
  duelMessage += `${armyNames.B}への被害: ${totalDamageB}\n`;
  duelMessage += `\n⚔️ **現在の戦況**\n`;
  duelMessage += `${armyNames.A}: ${aHP} 兵力\n`;
  duelMessage += `${armyNames.B}: ${bHP} 兵力\n`;
  
  // 通知フラグリセット
  await gameState.update({
    last_duel_round: currentRound,
    notification_40_sent: false,
    notification_30_sent: false,
    notification_20_sent: false,
    notification_10_sent: false,
    notification_5_sent: false,
  });
  
  await interaction.followUp(duelMessage);
}

// 決闘カウントダウン通知
async function manageDuelNotifications(interaction) {
  const gameState = await GameState.findOne();
  const totalActions = await User.sum('gekiha_counts');
  const nextDuel = Math.ceil(totalActions / gameState.duel_interval) * gameState.duel_interval;
  const remaining = nextDuel - totalActions;
  
  const notifications = [
    { remaining: 40, flag: 'notification_40_sent', message: '⚡ **準備段階** ビースト決闘まで残り **40行動**！\n🐾 ビーストのATKアップの最後のチャンス！' },
    { remaining: 30, flag: 'notification_30_sent', message: '🔥 **警戒段階** ビースト決闘まで残り **30行動**！\n🍖 餌やりでビーストを強化せよ！' },
    { remaining: 20, flag: 'notification_20_sent', message: '💀 **緊迫段階** ビースト決闘まで残り **20行動**！\n⚔️ 最終調整を急げ！' },
    { remaining: 10, flag: 'notification_10_sent', message: '🚨 **最終段階** ビースト決闘まで残り **10行動**！\n🗡️ 戦いの時は近い...覚悟を決めよ！' },
    { remaining: 5, flag: 'notification_5_sent', message: '💥 **緊急警報** 残り **5行動** で決闘開始！\n⚔️ 全軍、最終準備に入れ！' }
  ];
  
  for (const notif of notifications) {
    if (remaining <= notif.remaining && !gameState[notif.flag]) {
      await interaction.followUp(notif.message);
      await gameState.update({ [notif.flag]: true });
      break;
    }
  }
  
  if (remaining === 0) {
    await executeBeastDuel(interaction);
  }
}

export async function execute(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const username = interaction.member.displayName;
  const player = await User.findOne({ where: { id: userId } });
  const beastName = interaction.options.getString('name') || null;
  const customMessage = interaction.options.getString("message") || "";
  
  if (!player) return interaction.editReply('まず /kaikyu でチームに参加してください。');

  const army = player.army;
  const gameState = await GameState.findOne();
  
  if (gameState.rule_type !== 'beast') {
    return interaction.editReply('現在はビースト制ルールではありません。');
  }

  if (gameState.isGameOver) {
    return interaction.editReply("大戦はすでに終戦した！次回の号砲を待て！");
  }
  
  // ジャッジナンバー生成
  const randomNum = Math.floor(Math.random() * 1000);
  const randomStr = randomNum.toString().padStart(3, '0');
  const lastDigit = randomNum % 10;
  
  let message = `-#  :military_helmet: ${armyNames[army]} ${username} の【ビースト】行動判定！\n`;
  message += `### :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__\n`;
  
  // ビースト初期化 or 復活
  if (!player.beast_name || !player.beast_is_active) {
    // 戦闘不能からの復活時は名前を必須にする
    if (player.beast_name && !player.beast_is_active && !beastName) {
      return interaction.editReply(`💀 あなたのビースト **${player.beast_name}** は戦闘不能です。\n🐾 新しいビーストを召喚するには名前を指定してください。\n\n使用例: \`/beast name:フェニックス\``);
    }
    
    // 完全に初回の場合も名前を推奨
    if (!player.beast_name && !beastName) {
      return interaction.editReply(`🐾 初回のビースト召喚です！\n✨ ビーストに名前を付けてあげてください。\n\n使用例: \`/beast name:ドラゴン\``);
    }
    
    const newATK = determineATK(lastDigit);
    const finalBeastName = beastName;
    
    await player.update({
      beast_name: finalBeastName,
      beast_atk: newATK,
      beast_is_active: true,
      beast_has_fed: false,
      last_action_time: new Date()
    });
    
    if (player.beast_name && !player.beast_is_active) {
      // 復活メッセージ
      message += `### 🔥 新しいビースト **${finalBeastName}** が復活！ATK: ${newATK}\n`;
      message += `### 💀 前のビースト "${player.beast_name}" は戦闘不能でした\n`;
    } else {
      // 初回メッセージ
      message += `### 🐾 初のビースト **${finalBeastName}** が誕生！ATK: ${newATK}\n`;
    }
  } else {
    // 行動判定
    const action = processBeastAction(randomNum);
    message += `### ➡️ ${action.message}\n`;
    
    let kills = action.kills;
    let breakResult = '';
    
    // ビーストブレイク処理
    if (action.type === 'beast_break') {
      breakResult = await executeBeastBreak(army);
      message += `### ${breakResult}\n`;
    }
    
    // ATKアップ処理
    if (action.atkUp > 0) {
      const newATK = player.beast_atk + action.atkUp;
      await player.update({ 
        beast_atk: newATK,
        beast_has_fed: true 
      });
      message += `### 🍖 ${player.beast_name} のATKが ${player.beast_atk} → ${newATK} にアップ！\n`;
    }
    
    // 撃破処理
    if (kills > 0) {
      if (army === 'A') {
        gameState.a_team_kills += kills;
      } else {
        gameState.b_team_kills += kills;
      }
      
      player.total_kills += kills;
      message += `### ⚔️ 敵軍に ${kills} ダメージ！\n`;
    }
    
    await player.update({ last_action_time: new Date() });
  }
  
  // 行動回数更新
  player.gekiha_counts += 1;
  await player.save();
  await gameState.save();
  
  // 戦況表示
  const aHP = gameState.initialArmyHP - gameState.b_team_kills;
  const bHP = gameState.initialArmyHP - gameState.a_team_kills;
  message += `\n-# >>> :crossed_swords: 現在の戦況: ${armyNames.A} ${aHP} vs ${armyNames.B} ${bHP}\n`;
  
  // 決闘カウント表示
  const totalActions = await User.sum('gekiha_counts');
  const nextDuel = Math.ceil(totalActions / gameState.duel_interval) * gameState.duel_interval;
  const remaining = nextDuel - totalActions;
  
  if (remaining > 0) {
    message += `-# >>> ⚔️ 次回ビースト決闘まで: **${remaining}行動**\n`;
  }
  
  // 個人ビースト情報
  message += `-# >>> 🐾 あなたのビースト: **${player.beast_name}** (ATK: ${player.beast_atk})`;
  if (!player.beast_is_active) {
    message += ` 💀戦闘不能`;
  } else if (player.beast_has_fed) {
    message += ` 🍖強化済み`;
  }
  message += `\n`;
  
  // 戦績表示
  message += `-# >>> 🏅戦績: ${armyNames[army]} ${username} 行動数: **${player.gekiha_counts}回** 撃破数: **${player.total_kills}撃破**`;
  
  // カスタムメッセージ
  if (customMessage) {
    message += `\n\`\`\`${customMessage}\`\`\``;
  }
  
  await interaction.editReply(message);
  
  // 決闘通知チェック
  await manageDuelNotifications(interaction);
  
  // 終戦判定
  const loserTeam = await checkShusen();
  if (loserTeam) {
    const gameState = await GameState.findOne({ where: { id: 1 } });
    const totalKillsA = gameState.a_team_kills;
    const totalKillsB = gameState.b_team_kills;
    const remainingHP_A = gameState.initialArmyHP - totalKillsB;
    const remainingHP_B = gameState.initialArmyHP - totalKillsA;
    const winnerTeam = loserTeam === armyNames.A ? armyNames.B : armyNames.A;
    
    await interaction.followUp(`** 📢 ${loserTeam}の兵力が0になった。**\n# 🎖 ${winnerTeam}の勝利だ！\n\n🏆 大戦結果:\n 【${armyNames.A}の残存兵力】${remainingHP_A} \n 【${armyNames.B}の残存兵力】${remainingHP_B}\n\n**今次大戦は終戦した！次の大戦でまた会おう！**`);
    return;
  }

  return;
}