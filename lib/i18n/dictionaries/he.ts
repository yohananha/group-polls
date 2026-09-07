import type { Dictionary } from "./en";

function membersHe(n: number): string {
  if (n === 1) return "חבר אחד";
  if (n === 2) return "שני חברים";
  return `${n} חברים`;
}

function votesHe(n: number): string {
  if (n === 1) return "קול אחד";
  if (n === 2) return "שני קולות";
  return `${n} קולות`;
}

const he = {
  common: {
    someone: "מישהו",
    open: "פתוח",
    closed: "סגור",
    back: "חזרה",
    cancel: "ביטול",
  },
  languageSwitcher: {
    en: "English",
    he: "עברית",
  },
  header: {
    brand: "🗳️ סקרי קבוצה",
    signOut: "התנתקות",
  },
  login: {
    title: "סקרי קבוצה",
    subtitle: "תכריעו עם סקר. התחברו כדי להתחיל.",
    error: "משהו השתבש בהתחברות. נסו שוב.",
    signInWithGoogle: "התחברות עם Google",
  },
  home: {
    hey: (name: string) => `היי ${name}`,
    yourGroups: "הקבוצות שלך",
    noGroupsYet: "אתם לא חברים באף קבוצה עדיין — צרו קבוצה חדשה או הצטרפו עם קוד הזמנה.",
    startNewGroup: "התחלת קבוצה חדשה",
    joinWithInviteCode: "הצטרפות עם קוד הזמנה",
    groupSubtitle: (members: number, openPolls: number) =>
      `${membersHe(members)} · ${openPolls === 0 ? "אין סקרים פתוחים" : openPolls === 1 ? "סקר פתוח אחד" : `${openPolls} סקרים פתוחים`}`,
  },
  createGroupForm: {
    namePlaceholder: "למשל: חבורת שישי בערב",
    creating: "יוצר…",
    submit: "יצירת קבוצה",
  },
  joinGroupForm: {
    placeholder: "קוד הזמנה או קישור",
    joining: "מצטרף…",
    submit: "הצטרפות לקבוצה",
  },
  joinPage: {
    invitedTo: "הוזמנת להצטרף אל",
    members: membersHe,
  },
  inviteLink: {
    invite: "הזמנה:",
    copied: "הועתק!",
    copyInviteLink: "העתקת קישור הזמנה",
    copyFailed: "ההעתקה נכשלה",
    copyFailedFallback: "העתיקו את הקישור ידנית:",
  },
  sharePoll: {
    share: "שיתוף הסקר",
    copied: "הקישור הועתק!",
    copyFailed: "ההעתקה נכשלה",
    copyFailedFallback: "העתיקו את הקישור ידנית:",
    invitedToPollIn: "הוזמנת לצפות בסקר בקבוצת",
    joinToView: "הצטרפות וצפייה בסקר",
    joining: "מצטרף…",
  },
  group: {
    members: membersHe,
    newPoll: "סקר חדש",
    noPollsYet: "עדיין אין סקרים. שמישהו כבר יתחיל.",
  },
  pollType: {
    single: "בחירה יחידה",
    multi: "בחירה מרובה",
    rank: "דירוג",
    bracket: "טורניר",
  },
  newPollPage: {
    title: (groupName: string) => `סקר חדש בקבוצת ${groupName}`,
  },
  pollComposer: {
    pollType: "סוג הסקר",
    types: {
      single: { label: "בחירה יחידה", blurb: 'בחרו אחד. "מי מנצח — א׳ או ב׳?"' },
      multi: { label: "בחירה מרובה", blurb: 'בחרו כמה. "אילו מהבאים נכונים?"' },
      rank: { label: "דירוג", blurb: 'סדרו אותם. "דרגו את 10 המובילים."' },
      bracket: { label: "טורניר", blurb: "עימותים אחד על אחד, זוג בכל פעם." },
    },
    question: "שאלה",
    questionPlaceholder: "מי ינצח בקרב: דנה או מקס?",
    description: "תיאור",
    optional: "(אופציונלי)",
    pollColor: "צבע הסקר",
    options: "אפשרויות",
    minFour: "(מינימום 4)",
    addOption: "+ הוספת אפשרות",
    optionPlaceholder: (i: number) => `אפשרות ${i}`,
    removeOption: "הסרת אפשרות",
    settings: "הגדרות",
    letOthersAddOptions: "לאפשר לחברים אחרים להוסיף אפשרויות",
    requireApproval: "לדרוש את אישורי לפני שאפשרות שנוספה תופיע",
    letPeopleChangeVote: "לאפשר לאנשים לשנות את ההצבעה שלהם",
    hideWhoVoted: "להסתיר מי הצביע למה",
    resultsVisible: "תוצאות גלויות",
    visibilityAlways: "תמיד",
    visibilityAfterVote: "אחרי ההצבעה שלך",
    visibilityAfterClose: "רק אחרי סגירת הסקר",
    minPicks: "מינימום בחירות",
    maxPicks: "מקסימום בחירות",
    onlyRequireTop: "לדרוש דירוג רק של המובילים",
    topNPlaceholder: "הכול",
    posting: "מפרסם…",
    submit: "פרסום סקר",
  },
  pollDetail: {
    results: "תוצאות",
    pendingApproval: "ממתין לאישורך",
    approve: "אישור",
    approving: "…",
    needsApprovalNote: "דורש את אישור יוצר הסקר לפני שהוא נספר.",
    addOptionPlaceholder: "הוספת אפשרות",
    adding: "מוסיף…",
    add: "הוספה",
    votedNoChange: "הצבעת — סקר זה לא מאפשר שינויים.",
    hiddenUntilVote: "התוצאות מוסתרות עד שתצביעו.",
    hiddenUntilJudge: "התוצאות מוסתרות עד שתשפטו לפחות עימות אחד.",
    hiddenUntilClose: "התוצאות מוסתרות עד שהסקר ייסגר.",
    closePoll: "סגירת הסקר",
    deletePoll: "מחיקת הסקר",
    deleting: "מוחק…",
    deleteConfirm: "למחוק את הסקר הזה לכולם? לא ניתן לבטל פעולה זו.",
  },
  vote: {
    pickRange: (min: number, max: number) => (min === max ? `בחרו ${min}` : `בחרו ${min}–${max}`),
    selected: (n: number) => `נבחרו ${n}`,
    submit: "הצבעה",
    update: "עדכון הצבעה",
    saving: "שומר…",
    submitRanking: "שליחת דירוג",
    updateRanking: "עדכון דירוג",
    onlyTopCount: (n: number) => `רק ${n} המובילים שלכם נספרים — גררו, או השתמשו בחיצים.`,
    moveUp: "העברה למעלה",
    moveDown: "העברה למטה",
    dragToReorder: "גררו לסידור מחדש",
    whichWins: "מי מנצח?",
    judgedAllPairs: "שפטתם כל זוג. חזרו אם יתווספו עוד אפשרויות.",
    thisPollClosed: "הסקר הזה סגור.",
  },
  results: {
    noResultsYet: "אין עדיין תוצאות.",
    votes: votesHe,
    resultsHiddenDefault: "התוצאות מוסתרות כרגע.",
    turnout: (voted: number, total: number) => `${voted} מתוך ${membersHe(total)} הצביעו`,
    supportOf: (picked: number, reach: number) => `${picked} מתוך ${reach}`,
    percent: (n: number) => `${n}%`,
    avgRank: (n: number) => `מקום ממוצע ${n}`,
    wonOf: (won: number, played: number) => `ניצחה ב-${won} מתוך ${played}`,
    seenBy: (reach: number, total: number) => `נראתה ל-${reach} מתוך ${total} מצביעים`,
    notSeenYet: "טרם נראתה",
  },
  errors: {
    invalidInput: "קלט לא תקין",
    notSignedIn: "לא מחובר/ת",
    couldNotCreateGroup: "לא ניתן היה ליצור קבוצה, נסו שוב",
    invalidCode: "קוד לא תקין",
    codeDoesNotMatch: "קוד ההזמנה הזה לא תואם לאף קבוצה",
    couldNotStartSignIn: "לא ניתן היה להתחיל התחברות עם Google",
    invalidPoll: "סקר לא תקין",
    couldNotCreatePoll: "לא ניתן היה ליצור את הסקר",
    invalidOption: "אפשרות לא תקינה",
    invalidVote: "הצבעה לא תקינה",
    invalidMatchup: "עימות לא תקין",
    giveGroupAName: "תנו שם לקבוצה",
    giveOptionAName: "תנו שם לאפשרות הזו",
    atLeast2Options: "נדרשות לפחות 2 אפשרויות",
    bracketNeeds4Options: "סקרי טורניר דורשים לפחות 4 אפשרויות",
    pickAtLeast: (n: number) => `בחרו לפחות ${n}`,
  },
} satisfies Dictionary;

export default he;
