// 孩子档案数据模型和选项常量

// 性格标签选项（多选）
const PERSONALITY_OPTIONS = [
  { value: "sensitive", label: "敏感细腻", desc: "对情绪、语气特别敏感，容易共情但容易受伤" },
  { value: "active", label: "活泼外向", desc: "精力旺盛，喜欢社交，坐不住" },
  { value: "slow", label: "慢热谨慎", desc: "新环境先观察再行动，需要时间适应" },
  { value: "stubborn", label: "倔强坚持", desc: "主意大，认定的很难改，不轻易妥协" },
  { value: "quiet", label: "安静专注", desc: "能长时间沉浸一件事，不太主动表达" },
  { value: "intense", label: "情绪激烈", desc: "高兴和难过都很极端，情绪波动大" }
];

// 出生顺序
const BIRTH_ORDER_OPTIONS = [
  { value: "only", label: "独生子女" },
  { value: "eldest", label: "老大" },
  { value: "middle", label: "老二/老三" },
  { value: "youngest", label: "最小的" }
];

// 年级选项
const GRADE_OPTIONS = [
  { value: "preschool", label: "托班/幼儿园" },
  { value: "grade1", label: "1年级" },
  { value: "grade2", label: "2年级" },
  { value: "grade3", label: "3年级" },
  { value: "grade4", label: "4年级" },
  { value: "grade5", label: "5年级" },
  { value: "grade6", label: "6年级" },
  { value: "junior", label: "初中" },
  { value: "senior", label: "高中" }
];

// 性别
const GENDER_OPTIONS = [
  { value: "boy", label: "👦 男孩" },
  { value: "girl", label: "👧 女孩" }
];

// 当前年份减出生年份
function birthYearToAge(birthYear) {
  if (!birthYear) return null;
  return new Date().getFullYear() - parseInt(birthYear);
}

// 年龄 → 发展阶段标签
function ageToStage(age) {
  if (age === null || age === undefined) return "";
  if (age <= 3) return "0-3岁 语言黄金窗口";
  if (age <= 6) return "4-6岁 规则建立期";
  if (age <= 10) return "7-10岁 习惯养成期";
  if (age <= 13) return "11-13岁 青春期前期";
  return "14+岁 青春期";
}

// 档案 → AI 上下文摘要
function profileToContext(profile) {
  if (!profile) return "";
  const age = birthYearToAge(profile.birthYear);
  const stage = ageToStage(age);
  const personalityLabels = (profile.personality || [])
    .map(v => PERSONALITY_OPTIONS.find(p => p.value === v))
    .filter(Boolean)
    .map(p => p.label);
  const birthOrderLabel = BIRTH_ORDER_OPTIONS.find(b => b.value === profile.birthOrder);
  const gradeLabel = GRADE_OPTIONS.find(g => g.value === profile.grade);

  let ctx = `【孩子档案】\n昵称：${profile.name}`;
  if (profile.gender === "boy") ctx += "（男孩）";
  else if (profile.gender === "girl") ctx += "（女孩）";
  if (age !== null) ctx += `\n年龄：${age}岁（${stage}）`;
  if (gradeLabel) ctx += `\n年级：${gradeLabel.label}`;
  if (personalityLabels.length > 0) ctx += `\n性格特征：${personalityLabels.join("、")}`;
  if (birthOrderLabel) ctx += `\n出生顺序：${birthOrderLabel.label}`;
  if (profile.notes) ctx += `\n特别关注：${profile.notes}`;
  return ctx;
}

module.exports = {
  PERSONALITY_OPTIONS,
  BIRTH_ORDER_OPTIONS,
  GRADE_OPTIONS,
  GENDER_OPTIONS,
  birthYearToAge,
  ageToStage,
  profileToContext
};
