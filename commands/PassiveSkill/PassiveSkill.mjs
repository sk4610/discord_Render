import { SlashCommandBuilder } from 'discord.js';
import { GameState, User } from '../taisen/game.js';
import { armyNames } from '../armyname/armyname.js';
import { checkShusen } from '../taisen/game.js';

export const data = new SlashCommandBuilder()
  .setName('action')
  .setDescription('パッシブスキル制で行動します')
  .addStringOption(option =>
    option.setName("message")
      .setDescription("一言添える")
      .setRequired(false)
  );

// スキル定義
const SKILL_TYPES = [
  '攻撃', '補給', '先制', '逆襲', '必殺', 
  '強奪', '防御', '猛毒', '幸運', '破壊'
];

const SKILL_PROBABILITIES = {
  1: 40, // Lv1: 40%
  2: 30, // Lv2: 30%
  3: 20, // Lv3: 20%
  4: 10  // Lv4: 10%
};

// ランダムスキル取得
function generateRandomSkill() {
  // スキル種類をランダム選択
  const skillType = SKILL_TYPES[Math.floor(Math.random() * SKILL_TYPES.length)];
  
  // レベル決定（確率に基づく）
  const rand = Math.floor(Math.random() * 100);
  let level;
  if (rand < SKILL_PROBABILITIES[4]) level = 4;
  else if (rand < SKILL_PROBABILITIES[4] + SKILL_PROBABILITIES[3]) level = 3;
  else if (rand < SKILL_PROBABILITIES[4] + SKILL_PROBABILITIES[3] + SKILL_PROBABILITIES[2]) level = 2;
  else level = 1;
  
  return { type: skillType, level: level };
}

// 行動判定関数
function processPassiveAction(randomNum) {
  if (randomNum === 0) {
    return { type: 'massive_kill', kills: 8, message: '🔥 大量撃破！8撃破' };
  } else if ([11, 22, 33, 44, 55, 66, 77, 88, 99].includes(randomNum)) {
    return { type: 'normal_kill', kills: 1, message: ' ゾロ目！1撃破' };
  } else if ([10, 20, 30, 40, 50].includes(randomNum)) {
    return { type: 'skill_get', message: ':bulb: スキルゲット！' };
  } else if ([60, 70, 80, 90].includes(randomNum)) {
    return { type: 'skill_break', message: ':smiling_imp: スキルブレイク！' };
  } else {
    return { type: 'miss', kills: 0, message: 'ざんねん、ハズレ...' };
  }
}

// スキル効果適用（軍ベース）
async function applySkillEffects(army, action, gameState) {
  let additionalDamage = 0;
  let selfHeal = 0;
  let skillEffects = [];
  
  // 軍のスキルを取得
  const armySkillsField = `${army.toLowerCase()}_passive_skills`;
  const armySkills = gameState[armySkillsField] ? JSON.parse(gameState[armySkillsField]) : {};
  
  // 現在の兵力状況
  const myHP = gameState.initialArmyHP - (army === 'A' ? gameState.b_team_kills : gameState.a_team_kills);
  const enemyHP = gameState.initialArmyHP - (army === 'A' ? gameState.a_team_kills : gameState.b_team_kills);
  
  if (action.type === 'normal_kill') {
    // 攻撃スキル
    if (armySkills['攻撃']) {
      const bonus = armySkills['攻撃'];
      additionalDamage += bonus;
      skillEffects.push(`⚔️ ${armyNames[army]}の攻撃Lv${bonus}発動！追加${bonus}ダメージ`);
    }
    
    // 補給スキル
    if (armySkills['補給']) {
      const heal = armySkills['補給'];
      selfHeal += heal;
      skillEffects.push(`:helmet_with_cross: ${armyNames[army]}の補給Lv${heal}発動！自軍${heal}回復`);
    }
    
    // 先制スキル
    if (armySkills['先制'] && myHP > enemyHP) {
      const bonus = armySkills['先制'] * 2;
      additionalDamage += bonus;
      skillEffects.push(`:zap:  ${armyNames[army]}の先制Lv${armySkills['先制']}発動！追加${bonus}撃破`);
    }
    
    // 逆襲スキル
    if (armySkills['逆襲'] && myHP < enemyHP) {
      const bonus = armySkills['逆襲'] * 2;
      additionalDamage += bonus;
      skillEffects.push(`🔥 ${armyNames[army]}の逆襲Lv${armySkills['逆襲']}発動！追加${bonus}撃破`);
    }
  }
  
  if (action.type === 'massive_kill') {
    // 必殺スキル
    if (armySkills['必殺']) {
      const bonus = armySkills['必殺'] * 8;
      additionalDamage += bonus;
      skillEffects.push(`:citrus_sitorasu:  ${armyNames[army]}の必殺Lv${armySkills['必殺']}発動！追加${bonus}撃破`);
    }
    
    // 強奪スキル
    if (armySkills['強奪']) {
      const bonus = armySkills['強奪'] * 4;
      additionalDamage += bonus;
      selfHeal += bonus;
      skillEffects.push(`💰 ${armyNames[army]}の強奪Lv${armySkills['強奪']}発動！追加${bonus}撃破＆${bonus}回復`);
    }
  }
  
  return { additionalDamage, selfHeal, skillEffects };
}

// スキル取得処理（軍ベース）- レベル上書き対応版
async function processSkillGet(player, army, gameState) {
  //const armyNames = await getArmyNames();
  const armySkillsField = `${army.toLowerCase()}_passive_skills`;
  const currentSkills = gameState[armySkillsField] ? JSON.parse(gameState[armySkillsField]) : {};
  let message = '';
  let bonusDamage = 0;
  
  // 幸運スキルで追加取得判定
  let attempts = 1;
  if (currentSkills['幸運']) {
    const luckChance = currentSkills['幸運'] * 10;
    if (Math.floor(Math.random() * 100) < luckChance) {
      attempts = 2;
      message += `### 🍀 ${armyNames[army]}の幸運Lv${currentSkills['幸運']}発動！追加でスキル取得！\n`;
    }
  }
  
  for (let i = 0; i < attempts; i++) {
    const newSkill = generateRandomSkill();
    const skillKey = newSkill.type;
    const newLevel = newSkill.level;
    
    if (currentSkills[skillKey]) {
      const currentLevel = currentSkills[skillKey];
      
      // ⭐ 上位レベル取得時は上書き
      if (newLevel > currentLevel) {
        currentSkills[skillKey] = newLevel;
        message += `### ⬆️ ${armyNames[army]}の【${skillKey}】が Lv${currentLevel} → **Lv${newLevel}** にアップグレード！\n`;
      } 
      // ⭐ 下位または同レベル取得時は上書きせず1ダメージ
      else {
        bonusDamage += 1;
        message += `### 🔄 ${armyNames[army]}は【${skillKey}】Lv${newLevel}を取得済み（現在Lv${currentLevel}）！敵軍に1ダメージ\n`;
      }
    } else {
      // 新規スキル取得
      currentSkills[skillKey] = newLevel;
      message += `### ✨ ${armyNames[army]}が新スキル【${skillKey}】Lv${newLevel}を取得！\n`;
    }
  }
  
  // 軍のスキルデータ更新
  await gameState.update({ [armySkillsField]: JSON.stringify(currentSkills) });
  
  return { message, bonusDamage };
}

// スキルブレイク処理（軍ベース）
async function processSkillBreak(player, army, gameState) {
  const enemyArmy = army === 'A' ? 'B' : 'A';
  
  // 破壊スキルで追加ブレイク判定
  const armySkillsField = `${army.toLowerCase()}_passive_skills`;
  const armySkills = gameState[armySkillsField] ? JSON.parse(gameState[armySkillsField]) : {};
  let attempts = 1;
  if (armySkills['破壊']) {
    const destroyChance = armySkills['破壊'] * 10;
    if (Math.floor(Math.random() * 100) < destroyChance) {
      attempts = 2;
    }
  }
  
  let message = '';
  let bonusDamage = 0;
  
  for (let i = 0; i < attempts; i++) {
    // 敵軍のスキルを取得
    const enemySkillsField = `${enemyArmy.toLowerCase()}_passive_skills`;
    const enemySkills = gameState[enemySkillsField] ? JSON.parse(gameState[enemySkillsField]) : {};
    const skillKeys = Object.keys(enemySkills);
    
    if (skillKeys.length === 0) {
      bonusDamage += 1;
      message += `💥 ${armyNames[enemyArmy]}にスキル無し！代わりに1撃破\n`;
      continue;
    }
    
    // ランダムなスキルを選択して削除
    const targetSkill = skillKeys[Math.floor(Math.random() * skillKeys.length)];
    delete enemySkills[targetSkill];
    await gameState.update({ [enemySkillsField]: JSON.stringify(enemySkills) });
    
    message += `💣 ${armyNames[enemyArmy]}の【${targetSkill}】を破壊！\n`;
  }
  
  if (attempts > 1) {
    message = `🔨 ${armyNames[army]}の破壊Lv${armySkills['破壊']}発動！追加ブレイク！\n` + message;
  }
  
  return { message, bonusDamage };
}

// 猛毒効果処理（100の倍数レス時）- 軍ベース
async function processPoisonEffect(interaction) {
  const totalActions = await User.sum('gekiha_counts');
  
  if (totalActions % 100 === 0) {
    const gameState = await GameState.findOne();
    const armies = ['A', 'B'];
    let poisonMessage = '';
    
    for (const army of armies) {
      const armySkillsField = `${army.toLowerCase()}_passive_skills`;
      const armySkills = gameState[armySkillsField] ? JSON.parse(gameState[armySkillsField]) : {};
      
      if (armySkills['猛毒']) {
        const poisonDamage = armySkills['猛毒'] * 4;
        const enemyArmy = army === 'A' ? 'B' : 'A';
        
        if (army === 'A') {
          gameState.a_team_kills += poisonDamage;
        } else {
          gameState.b_team_kills += poisonDamage;
        }
        
        poisonMessage += `☠️ ${armyNames[army]}の猛毒Lv${armySkills['猛毒']}効果！${armyNames[enemyArmy]}に${poisonDamage}撃破！\n`;
      }
    }
    
    if (poisonMessage) {
      await gameState.save();
      await interaction.followUp(`### ☠️ **${totalActions}レス到達！猛毒発動！**\n${poisonMessage}`);
    }
  }
}

export async function execute(interaction) {
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
  
  if (gameState.rule_type !== 'passive') {
    return await interaction.editReply('現在はパッシブスキル制ルールではありません。');
  }

  if (gameState.isGameOver) {
    return await interaction.editReply("大戦はすでに終戦した！次回の号砲を待て！");
  }
  
  try {
    // ジャッジナンバー生成
    const randomNum = Math.floor(Math.random() * 100);
    const randomStr = randomNum.toString().padStart(2, '0');
    
    let message = `-#  :military_helmet: ${armyNames[army]} ${username} の行動判定！\n`;
    message += `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${randomStr}__**`;
    
    // 行動判定
    const action = processPassiveAction(randomNum);
    message += ` → ${action.message}\n`;
    
    let totalDamage = action.kills || 0;
    let totalHeal = 0;
    
    // スキル関連処理
    if (action.type === 'skill_get') {
      const skillResult = await processSkillGet(player, army, gameState);
      message += skillResult.message;
      totalDamage += skillResult.bonusDamage;
    } else if (action.type === 'skill_break') {
      const breakResult = await processSkillBreak(player, army, gameState);
      message += breakResult.message;
      totalDamage += breakResult.bonusDamage;
    }
    
    // スキル効果適用
    if (action.type === 'normal_kill' || action.type === 'massive_kill') {
      const skillEffects = await applySkillEffects(army, action, gameState);
      totalDamage += skillEffects.additionalDamage;
      totalHeal += skillEffects.selfHeal;
      
      if (skillEffects.skillEffects.length > 0) {
        message += skillEffects.skillEffects.map(effect => `** ${effect}`).join('\n') + '\n';
      }
    }
    
    // ダメージ適用
    if (totalDamage > 0) {
      if (army === 'A') {
        gameState.a_team_kills += totalDamage;
      } else {
        gameState.b_team_kills += totalDamage;
      }
      player.total_kills += totalDamage;
    }
    
    // 回復適用
    if (totalHeal > 0) {
      if (army === 'A') {
        gameState.b_team_kills = Math.max(0, gameState.b_team_kills - totalHeal);
      } else {
        gameState.a_team_kills = Math.max(0, gameState.a_team_kills - totalHeal);
      }
      message += `### 💚 自軍が${totalHeal}回復！\n`;
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
    
    // スキル一覧表示（常時）- 軍ベース
    const armySkillsField = `${army.toLowerCase()}_passive_skills`;
    const armySkills = gameState[armySkillsField] ? JSON.parse(gameState[armySkillsField]) : {};
    const skillList = Object.entries(armySkills).map(([type, level]) => `${type}Lv${level}`).join(', ');
    message += `-# >>> :gear: ${armyNames[army]}のスキル: ${skillList || 'なし'}\n`;
    
    // カスタムメッセージ
    if (customMessage) {
      message += `\`\`\`${customMessage}\`\`\`\n`;
    }
    
    await interaction.editReply(message);
    
    // BOB支援制度（パッシブスキル制対応）
if (player.bobEnabled) {
const bobId = `bob-${userId}`;
let bobUser = await User.findOne({ where: { id: bobId } });
// BOBユーザーが存在しない場合は作成
if (!bobUser) {
const bobname = `BOB - ${username}のパートナー`;
bobUser = await User.create({
id: bobId,
username: bobname,
army: army,
rank: '二等兵🔸',
total_kills: 0
});
console.log('BOBユーザーを新規作成:', bobname);
}
if (bobUser) {
// BOB用のジャッジナンバー生成
const bobRandomNum = Math.floor(Math.random() * 100);
const bobRandomStr = bobRandomNum.toString().padStart(2, '0');
let bobMessage = `-# **BOB支援制度**が発動！\n`;
const emoji = "<:custom_emoji:1350367513271341088>";
bobMessage += `-# ${emoji} ${armyNames[army]} ${bobUser.username} の行動判定！\n`;
bobMessage += `** :scales: ｼﾞｬｯｼﾞﾅﾝﾊﾞｰ: __${bobRandomStr}__**`;
// BOB行動判定
const bobAction = processPassiveAction(bobRandomNum);
bobMessage += `→ ${bobAction.message}\n`;
let bobTotalDamage = bobAction.kills || 0;
let bobTotalHeal = 0;
// BOBスキル関連処理
if (bobAction.type === 'skill_get') {
const bobSkillResult = await processSkillGet(bobUser, army, gameState);
bobMessage += bobSkillResult.message;
bobTotalDamage += bobSkillResult.bonusDamage;
} else if (bobAction.type === 'skill_break') {
const bobBreakResult = await processSkillBreak(bobUser, army, gameState);
bobMessage += bobBreakResult.message;
bobTotalDamage += bobBreakResult.bonusDamage;
}
// BOBスキル効果適用
if (bobAction.type === 'normal_kill' || bobAction.type === 'massive_kill') {
const bobSkillEffects = await applySkillEffects(army, bobAction, gameState);
bobTotalDamage += bobSkillEffects.additionalDamage;
bobTotalHeal += bobSkillEffects.selfHeal;
if (bobSkillEffects.skillEffects.length > 0) {
bobMessage += bobSkillEffects.skillEffects.map(effect => `### ${effect}`).join('\n') + '\n';
}
}
// BOBダメージ適用
if (bobTotalDamage > 0) {
if (army === 'A') {
gameState.a_team_kills += bobTotalDamage;
} else {
gameState.b_team_kills += bobTotalDamage;
}
bobUser.total_kills += bobTotalDamage;
}
// BOB回復適用
if (bobTotalHeal > 0) {
if (army === 'A') {
gameState.b_team_kills = Math.max(0, gameState.b_team_kills - bobTotalHeal);
} else {
gameState.a_team_kills = Math.max(0, gameState.a_team_kills - bobTotalHeal);
}
bobMessage += `### 💚 自軍が${bobTotalHeal}回復！\n`;
}
// BOB行動回数更新
bobUser.gekiha_counts += 1;
await bobUser.save();
await gameState.save();
// BOB戦況表示（ダメージ時のみ）
if (bobTotalDamage > 0) {
const aHP = gameState.initialArmyHP - gameState.b_team_kills;
const bHP = gameState.initialArmyHP - gameState.a_team_kills;
bobMessage += `-# >>> :crossed_swords: 現在の戦況: ${armyNames.A} ${aHP} vs ${armyNames.B} ${bHP}\n`;
bobMessage += `-# >>> 🏅戦績: ${armyNames[army]} ${bobUser.username} 行動数: **${bobUser.gekiha_counts}回** 撃破数: **${bobUser.total_kills}撃破**\n`;
}
// BOB軍スキル一覧表示（常時）
const armySkillsField = `${army.toLowerCase()}_passive_skills`;
const armySkills = gameState[armySkillsField] ? JSON.parse(gameState[armySkillsField]) : {};
const skillList = Object.entries(armySkills).map(([type, level]) => `${type}Lv${level}`).join(', ');
bobMessage += `-# >>> 🎯 ${armyNames[army]}のスキル: ${skillList || 'なし'}\n`;
await interaction.followUp(bobMessage);
}
}
    // 猛毒効果チェック
    await processPoisonEffect(interaction);
    
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
    console.error('パッシブスキル処理エラー:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply('エラー: パッシブスキル処理に失敗しました');
    } else if (interaction.deferred) {
      await interaction.editReply('エラー: パッシブスキル処理に失敗しました');
    }
  }
}