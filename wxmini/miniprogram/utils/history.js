// 历史对话时间格式化

function formatHistoryTime(createdAt) {
  if (!createdAt) return "";

  let d;
  if (createdAt instanceof Date) {
    d = createdAt;
  } else if (typeof createdAt === "object" && createdAt.$date) {
    d = new Date(createdAt.$date);
  } else {
    d = new Date(createdAt);
  }

  if (isNaN(d.getTime())) return "";

  const pad = n => String(n).padStart(2, "0");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today - target) / 86400000);

  if (diffDays === 0) return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (diffDays === 1) return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (diffDays < 7) return `${diffDays}天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function historyPreview(item) {
  const answer = item.answer || {};
  return answer.script || answer.emotionalCheck || answer.promptText || "查看详情";
}

module.exports = { formatHistoryTime, historyPreview };
