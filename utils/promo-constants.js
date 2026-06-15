/** 运营弹窗：7 天行为阈值 + 7 天展示频控（与 运营分析.txt / 指导.txt 对齐） */
const PROMO_INACTIVE_DAYS = 7
const PROMO_MIN_INTERVAL_MS = PROMO_INACTIVE_DAYS * 24 * 60 * 60 * 1000
const PROMO_SNOOZE_MS = PROMO_INACTIVE_DAYS * 24 * 60 * 60 * 1000

const STORAGE = {
  LAST_VISIT_AT: 'mb_last_visit_at',
  LAST_PHONE_LOGIN_AT: 'mb_last_phone_login_at',
  LAST_CARD_MAKE_AT: 'mb_last_card_make_at',
  LAST_MUSIC_GENERATE_AT: 'mb_last_music_generate_at',
  LAST_COMMUNITY_POST_AT: 'mb_last_community_post_at',
  FIRST_VISIT_AT: 'mb_first_visit_at',
  LAST_SHOW_AT: 'mb_promo_last_show_at',
  SNOOZE_UNTIL: 'mb_promo_snooze_until',
  SESSION_CLOSED: 'mb_promo_session_closed_ids',
  REMOTE_CACHE: 'mb_promo_remote_cache',
  MIGRATED_V1: 'mb_promo_migrated_v1'
}

const LEGACY_DISMISS_KEYS = [
  'mb_home_mianjia_entry_dismissed_date',
  'mb_complete_mianjia_tip_dismissed_date',
  'mb_player_mianjia_tip_dismissed_date'
]

/** 禁止弹窗的路由片段 */
const BLOCKED_ROUTE_PARTS = [
  'package-create/pages/create/generating',
  'package-create/pages/create/tracks',
  'package-create/pages/create/gift',
  'package-community/pages/post/create'
]

const SCENES = {
  HOME: 'home_show',
  COMPLETE: 'complete_show',
  PLAYER: 'player_show',
  MINE: 'mine_show',
  COMMUNITY: 'community_show',
  AFTER_CARD_SHARE: 'after_card_share',
  AFTER_GENERATE: 'after_generate'
}

module.exports = {
  PROMO_INACTIVE_DAYS,
  PROMO_MIN_INTERVAL_MS,
  PROMO_SNOOZE_MS,
  STORAGE,
  LEGACY_DISMISS_KEYS,
  BLOCKED_ROUTE_PARTS,
  SCENES
}
