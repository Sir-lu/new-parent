// 场景卡片数据：5 大类 × 每类 3 场景 = 15 个
const SCENE_CATEGORIES = [
  {
    id: "school",
    name: "🏫 上学问题",
    scenes: [
      { id: "no-school", name: "不想上学", icon: "🏃", hint: "早上赖床、哭着不去、找各种理由" },
      { id: "homework", name: "写作业拖拉", icon: "📝", hint: "磨蹭、走神、写到很晚" },
      { id: "teacher", name: "被老师投诉", icon: "📋", hint: "上课不专心、和同学冲突" }
    ]
  },
  {
    id: "daily",
    name: "🍽️ 吃饭睡觉",
    scenes: [
      { id: "no-eat", name: "不吃饭/挑食", icon: "🥄", hint: "这不吃那不吃、要追着喂" },
      { id: "no-sleep", name: "不肯睡觉", icon: "😴", hint: "到点了不睡、反复起来" },
      { id: "morning", name: "早上赖床", icon: "⏰", hint: "叫不起来、起床气大" }
    ]
  },
  {
    id: "social",
    name: "👫 社交同伴",
    scenes: [
      { id: "fight", name: "与同学冲突", icon: "⚡", hint: "吵架、打架、被孤立" },
      { id: "bullied", name: "被欺负/不合群", icon: "😢", hint: "回来说没人跟他玩" },
      { id: "sibling", name: "兄弟姐妹打架", icon: "👧👦", hint: "抢东西、争宠、互相告状" }
    ]
  },
  {
    id: "emotion",
    name: "💢 情绪管理",
    scenes: [
      { id: "tantrum", name: "大哭大闹", icon: "😭", hint: "一不满足就崩溃、收不住" },
      { id: "anger", name: "发脾气摔东西", icon: "😤", hint: "摔门、砸东西、大喊大叫" },
      { id: "shy", name: "胆小不敢尝试", icon: "🫣", hint: "什么都怕、总说"我不行"" }
    ]
  },
  {
    id: "habit",
    name: "📱 习惯养成",
    scenes: [
      { id: "screen", name: "沉迷手机/平板", icon: "📱", hint: "抱着放不下、约定时间不算" },
      { id: "buying", name: "买东西撒泼", icon: "🛒", hint: "看到就要买、不给就闹" },
      { id: "lying", name: "说谎/偷东西", icon: "🤥", hint: "不承认、藏东西、拿别人的" }
    ]
  }
];

module.exports = { SCENE_CATEGORIES };
