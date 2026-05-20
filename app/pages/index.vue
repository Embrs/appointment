<script setup lang="ts">
// PageIndex — 平台首頁（landing page）
// 多商家預約 SaaS 對外介紹頁，未登入顯示登入/註冊，已登入顯示進入後台

definePageMeta({ layout: 'default' });

const storeSelf = StoreSelf();

const isSignedIn = computed(() => storeSelf.isSignIn);
const selfType = computed(() => storeSelf.selfType);

const consoleHref = computed(() => {
  if (selfType.value === 'admin') return '/sys';
  if (selfType.value === 'merchant') return '/admin';
  return '/sign-in';
});

const consoleLabel = computed(() => {
  if (selfType.value === 'admin') return '進入平台後台';
  if (selfType.value === 'merchant') return '進入商家後台';
  return '商家登入';
});

const bookingModes = [
  {
    tag: '01',
    title: '固定時段',
    desc: '依服務時長切出固定時段，每段只接一組客人。適合一對一服務、諮商、課程預約。'
  },
  {
    tag: '02',
    title: '時段＋人數',
    desc: '同一時段可同時接受多位客人，自動控管每段容量。適合團體課、共享空間、桌位制餐廳。'
  },
  {
    tag: '03',
    title: '指定資源',
    desc: '客人可挑選技師、座位或設備，自動避開資源衝突。適合美髮、美甲、SPA、健身房器材。'
  },
  {
    tag: '04',
    title: '號碼牌排隊',
    desc: '客人線上領號、即時叫號，省去現場排隊。適合醫療診所、銀行櫃台、餐廳取餐。'
  }
];

const features = [
  { title: '完整商家後台', desc: '服務、資源、員工、排班、休假，一站管理。' },
  { title: '智慧可用時段', desc: '依服務時長、容量、資源、休假自動計算，杜絕雙重預約。' },
  { title: '即時叫號廣播', desc: 'WebSocket 推播，叫號台與顧客端毫秒同步，無需手動刷新。' },
  { title: '專屬對外連結', desc: '每個商家配發專屬網址與 QR Code，直接張貼於店面。' },
  { title: '彈性取消政策', desc: '可設定取消截止時間，逾期由商家代為處理。' },
  { title: '繁中／英／日', desc: '內建三語介面，跨境經營也無痛上手。' }
];

const steps = [
  { num: '1', title: '註冊申請', desc: '填寫商家資訊送出，等待平台審核。' },
  { num: '2', title: '完成設定', desc: '建立服務、資源、營業時段與員工。' },
  { num: '3', title: '開始接單', desc: '分享專屬連結，顧客即可線上預約。' }
];
</script>

<template lang="pug">
.PageIndex
  //- 頂部導覽
  header.PageIndex__nav
    .PageIndex__navInner
      .PageIndex__brand
        .PageIndex__brandMark A
        .PageIndex__brandName Appointment
      nav.PageIndex__navLinks
        a.PageIndex__navLink(href="#modes") 預約模式
        a.PageIndex__navLink(href="#features") 平台特色
        a.PageIndex__navLink(href="#how") 開始使用
      .PageIndex__navActions
        template(v-if="isSignedIn")
          NuxtLinkLocale.PageIndex__btn.PageIndex__btn--primary(:to="consoleHref") {{ consoleLabel }}
        template(v-else)
          NuxtLinkLocale.PageIndex__btn.PageIndex__btn--ghost(to="/sign-in") 商家登入
          NuxtLinkLocale.PageIndex__btn.PageIndex__btn--primary(to="/sign-up") 立即註冊

  //- Hero 主視覺
  section.PageIndex__hero
    .PageIndex__heroInner
      .PageIndex__heroCopy
        .PageIndex__eyebrow 多商家預約 SaaS 平台
        h1.PageIndex__heroTitle
          | 一套系統，
          br
          | 接住所有預約場景
        p.PageIndex__heroLead
          | 從固定時段、人數容量、指定資源到號碼牌排隊，
          br
          | 四種模式自由切換，覆蓋餐廳、診所、美業、健身、課程等各行業。
        .PageIndex__heroActions(v-if="!isSignedIn")
          NuxtLinkLocale.PageIndex__btn.PageIndex__btn--primary.PageIndex__btn--lg(to="/sign-up") 免費開店
          NuxtLinkLocale.PageIndex__btn.PageIndex__btn--outline.PageIndex__btn--lg(to="/sign-in") 商家登入
        .PageIndex__heroActions(v-else)
          NuxtLinkLocale.PageIndex__btn.PageIndex__btn--primary.PageIndex__btn--lg(:to="consoleHref") {{ consoleLabel }}
        ul.PageIndex__heroMeta
          li.PageIndex__heroMetaItem 註冊免費
          li.PageIndex__heroMetaItem 隨開隨用
          li.PageIndex__heroMetaItem 繁中／英／日
      .PageIndex__heroVisual
        .PageIndex__heroCard.PageIndex__heroCard--a
          .PageIndex__heroCardLabel 今日預約
          .PageIndex__heroCardValue 38
          .PageIndex__heroCardHint 已確認 32 ／ 待處理 6
        .PageIndex__heroCard.PageIndex__heroCard--b
          .PageIndex__heroCardLabel 等候叫號
          .PageIndex__heroCardValue A-024
          .PageIndex__heroCardHint 前面還有 3 位
        .PageIndex__heroCard.PageIndex__heroCard--c
          .PageIndex__heroCardLabel 今日時段
          .PageIndex__heroCardSlots
            span.PageIndex__heroSlot.PageIndex__heroSlot--full 09:00
            span.PageIndex__heroSlot 09:30
            span.PageIndex__heroSlot.PageIndex__heroSlot--full 10:00
            span.PageIndex__heroSlot 10:30
            span.PageIndex__heroSlot 11:00
            span.PageIndex__heroSlot.PageIndex__heroSlot--full 11:30

  //- 四種預約模式
  section#modes.PageIndex__section
    .PageIndex__sectionInner
      .PageIndex__sectionHead
        .PageIndex__eyebrow 預約模式
        h2.PageIndex__sectionTitle 四種模式，覆蓋各行業預約需求
        p.PageIndex__sectionLead 每個服務獨立設定，同一商家可混用不同模式。
      .PageIndex__modes
        .PageIndex__modeCard(v-for="m in bookingModes" :key="m.tag")
          .PageIndex__modeTag {{ m.tag }}
          h3.PageIndex__modeTitle {{ m.title }}
          p.PageIndex__modeDesc {{ m.desc }}

  //- 核心功能
  section#features.PageIndex__section.PageIndex__section--alt
    .PageIndex__sectionInner
      .PageIndex__sectionHead
        .PageIndex__eyebrow 平台特色
        h2.PageIndex__sectionTitle 一條龍的商家經營體驗
        p.PageIndex__sectionLead 從顧客觸及到後台管理，所有環節為你準備好。
      .PageIndex__features
        .PageIndex__featureCard(v-for="f in features" :key="f.title")
          .PageIndex__featureIcon
            span.PageIndex__featureDot
          h3.PageIndex__featureTitle {{ f.title }}
          p.PageIndex__featureDesc {{ f.desc }}

  //- 三步驟
  section#how.PageIndex__section
    .PageIndex__sectionInner
      .PageIndex__sectionHead
        .PageIndex__eyebrow 開始使用
        h2.PageIndex__sectionTitle 三個步驟，今天就上線
      ol.PageIndex__steps
        li.PageIndex__step(v-for="s in steps" :key="s.num")
          .PageIndex__stepNum {{ s.num }}
          h3.PageIndex__stepTitle {{ s.title }}
          p.PageIndex__stepDesc {{ s.desc }}

  //- 底部 CTA
  section.PageIndex__cta
    .PageIndex__ctaInner
      h2.PageIndex__ctaTitle 準備好把預約交給系統了嗎？
      p.PageIndex__ctaLead 免費註冊、即時審核，幾分鐘內開始接受線上預約。
      .PageIndex__ctaActions(v-if="!isSignedIn")
        NuxtLinkLocale.PageIndex__btn.PageIndex__btn--primary.PageIndex__btn--lg(to="/sign-up") 立即免費註冊
        NuxtLinkLocale.PageIndex__btn.PageIndex__btn--ghostLight.PageIndex__btn--lg(to="/sign-in") 已有帳號，登入
      .PageIndex__ctaActions(v-else)
        NuxtLinkLocale.PageIndex__btn.PageIndex__btn--primary.PageIndex__btn--lg(:to="consoleHref") {{ consoleLabel }}

  //- Footer
  footer.PageIndex__footer
    .PageIndex__footerInner
      .PageIndex__footerCol
        .PageIndex__brand
          .PageIndex__brandMark.PageIndex__brandMark--sm A
          .PageIndex__brandName.PageIndex__brandName--sm Appointment
        p.PageIndex__footerNote 多商家預約 SaaS 平台
      .PageIndex__footerCol
        .PageIndex__footerHead 商家
        NuxtLinkLocale.PageIndex__footerLink(to="/sign-in") 商家登入
        NuxtLinkLocale.PageIndex__footerLink(to="/sign-up") 註冊申請
        NuxtLinkLocale.PageIndex__footerLink(to="/forgot-password") 忘記密碼
      .PageIndex__footerCol
        .PageIndex__footerHead 平台
        NuxtLinkLocale.PageIndex__footerLink(to="/sys/sign-in") 平台管理員登入
      .PageIndex__footerCol
        .PageIndex__footerHead 關於
        a.PageIndex__footerLink(href="#modes") 預約模式
        a.PageIndex__footerLink(href="#features") 平台特色
        a.PageIndex__footerLink(href="#how") 開始使用
    .PageIndex__footerBar
      span.PageIndex__footerCopy © {{ new Date().getFullYear() }} Appointment Platform
</template>

<style lang="scss" scoped>
// 共用變數
$navHeight: 64px;

// 容器 ----
.PageIndex {
  min-height: 100vh;
  background-color: $bg;
  color: $font;
}

// 導覽 ----
.PageIndex__nav {
  position: sticky;
  top: 0;
  z-index: 50;
  height: $navHeight;
  background-color: rgba(253, 249, 242, 0.92);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid rgba(53, 77, 123, 0.08);
}

.PageIndex__navInner {
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.PageIndex__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.PageIndex__brandMark {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, $primary, $secondary);
  color: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.02em;
}

.PageIndex__brandMark--sm {
  width: 28px;
  height: 28px;
  font-size: 14px;
}

.PageIndex__brandName {
  font-size: 16px;
  font-weight: 700;
  color: $primary;
  letter-spacing: 0.02em;
}

.PageIndex__brandName--sm {
  font-size: 14px;
}

.PageIndex__navLinks {
  display: flex;
  align-items: center;
  gap: 28px;
}

.PageIndex__navLink {
  font-size: 14px;
  color: $font;
  text-decoration: none;
  transition: color 0.15s ease;
}

.PageIndex__navLink:hover {
  color: $primary;
}

.PageIndex__navActions {
  display: flex;
  align-items: center;
  gap: 12px;
}

// 按鈕 ----
.PageIndex__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid transparent;
  transition: transform 0.12s ease, box-shadow 0.15s ease, background-color 0.15s ease, color 0.15s ease;
  cursor: pointer;
  white-space: nowrap;
}

.PageIndex__btn:hover {
  transform: translateY(-1px);
}

.PageIndex__btn--lg {
  height: 48px;
  padding: 0 26px;
  font-size: 15px;
  border-radius: 10px;
}

.PageIndex__btn--primary {
  background-color: $primary;
  color: $white;
}

.PageIndex__btn--primary:hover {
  box-shadow: 0 8px 20px rgba(53, 77, 123, 0.25);
}

.PageIndex__btn--outline {
  background-color: transparent;
  color: $primary;
  border-color: rgba(53, 77, 123, 0.3);
}

.PageIndex__btn--outline:hover {
  border-color: $primary;
  background-color: rgba(53, 77, 123, 0.04);
}

.PageIndex__btn--ghost {
  background-color: transparent;
  color: $primary;
}

.PageIndex__btn--ghost:hover {
  background-color: rgba(53, 77, 123, 0.06);
}

.PageIndex__btn--ghostLight {
  background-color: rgba(255, 255, 255, 0.12);
  color: $white;
  border-color: rgba(255, 255, 255, 0.3);
}

.PageIndex__btn--ghostLight:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

// Hero ----
.PageIndex__hero {
  padding: 72px 24px 96px;
  background:
    radial-gradient(1100px 500px at 85% -10%, rgba(235, 139, 45, 0.18), transparent 60%),
    radial-gradient(900px 500px at -10% 30%, rgba(0, 173, 169, 0.16), transparent 65%);
}

.PageIndex__heroInner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 48px;
  align-items: center;
}

.PageIndex__eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  background-color: rgba(53, 77, 123, 0.08);
  color: $primary;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.PageIndex__heroTitle {
  margin: 20px 0 16px;
  font-size: 48px;
  line-height: 1.18;
  font-weight: 700;
  color: #1f2a44;
  letter-spacing: -0.01em;
}

.PageIndex__heroLead {
  margin: 0 0 28px;
  font-size: 16px;
  line-height: 1.75;
  color: rgba(69, 69, 69, 0.78);
}

.PageIndex__heroActions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
}

.PageIndex__heroMeta {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  font-size: 13px;
  color: rgba(69, 69, 69, 0.7);
}

.PageIndex__heroMetaItem {
  display: inline-flex;
  align-items: center;
}

.PageIndex__heroMetaItem::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: $secondary;
  margin-right: 8px;
}

// Hero 視覺卡片
.PageIndex__heroVisual {
  position: relative;
  height: 420px;
}

.PageIndex__heroCard {
  position: absolute;
  background-color: $white;
  border-radius: 16px;
  padding: 22px 24px;
  box-shadow: 0 24px 60px -20px rgba(31, 42, 68, 0.25);
  border: 1px solid rgba(53, 77, 123, 0.06);
}

.PageIndex__heroCard--a {
  top: 30px;
  left: 30px;
  width: 220px;
}

.PageIndex__heroCard--b {
  top: 110px;
  right: 0;
  width: 220px;
  background: linear-gradient(135deg, $primary, #2a3d62);
  color: $white;
  border-color: transparent;
}

.PageIndex__heroCard--c {
  bottom: 0;
  left: 80px;
  width: 320px;
}

.PageIndex__heroCardLabel {
  font-size: 12px;
  opacity: 0.7;
  letter-spacing: 0.04em;
}

.PageIndex__heroCardValue {
  margin-top: 6px;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
}

.PageIndex__heroCardHint {
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.65;
}

.PageIndex__heroCardSlots {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.PageIndex__heroSlot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  border-radius: 6px;
  background-color: rgba(0, 173, 169, 0.1);
  color: $secondary;
  font-size: 12px;
  font-weight: 600;
}

.PageIndex__heroSlot--full {
  background-color: rgba(69, 69, 69, 0.08);
  color: rgba(69, 69, 69, 0.4);
  text-decoration: line-through;
}

// 區塊 ----
.PageIndex__section {
  padding: 80px 24px;
}

.PageIndex__section--alt {
  background-color: $white;
}

.PageIndex__sectionInner {
  max-width: 1200px;
  margin: 0 auto;
}

.PageIndex__sectionHead {
  text-align: center;
  margin-bottom: 48px;
}

.PageIndex__sectionTitle {
  margin: 16px 0 12px;
  font-size: 32px;
  font-weight: 700;
  color: #1f2a44;
  letter-spacing: -0.005em;
}

.PageIndex__sectionLead {
  margin: 0 auto;
  max-width: 560px;
  font-size: 15px;
  line-height: 1.7;
  color: rgba(69, 69, 69, 0.7);
}

// 預約模式 ----
.PageIndex__modes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.PageIndex__modeCard {
  position: relative;
  padding: 28px 24px;
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.PageIndex__modeCard:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 40px -20px rgba(31, 42, 68, 0.2);
  border-color: rgba(53, 77, 123, 0.18);
}

.PageIndex__modeTag {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: $tertiary;
  margin-bottom: 12px;
}

.PageIndex__modeTitle {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 700;
  color: $primary;
}

.PageIndex__modeDesc {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.7;
  color: rgba(69, 69, 69, 0.78);
}

// 平台特色 ----
.PageIndex__features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.PageIndex__featureCard {
  padding: 26px 24px;
  background-color: $bg;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.06);
}

.PageIndex__featureIcon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(53, 77, 123, 0.12), rgba(0, 173, 169, 0.12));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.PageIndex__featureDot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary, $secondary);
}

.PageIndex__featureTitle {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
  color: $primary;
}

.PageIndex__featureDesc {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.7;
  color: rgba(69, 69, 69, 0.75);
}

// 步驟 ----
.PageIndex__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.PageIndex__step {
  position: relative;
  padding: 32px 28px;
  background-color: $white;
  border-radius: 16px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.PageIndex__stepNum {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background-color: $primary;
  color: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
}

.PageIndex__stepTitle {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 700;
  color: $primary;
}

.PageIndex__stepDesc {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: rgba(69, 69, 69, 0.75);
}

// 底部 CTA ----
.PageIndex__cta {
  padding: 80px 24px;
  background: linear-gradient(135deg, $primary 0%, #2a3d62 60%, #1d2c4a 100%);
  color: $white;
}

.PageIndex__ctaInner {
  max-width: 720px;
  margin: 0 auto;
  text-align: center;
}

.PageIndex__ctaTitle {
  margin: 0 0 12px;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.005em;
}

.PageIndex__ctaLead {
  margin: 0 0 28px;
  font-size: 15px;
  line-height: 1.7;
  opacity: 0.85;
}

.PageIndex__ctaActions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

// Footer ----
.PageIndex__footer {
  background-color: #f1ede4;
  padding: 56px 24px 24px;
  border-top: 1px solid rgba(53, 77, 123, 0.08);
}

.PageIndex__footerInner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 32px;
}

.PageIndex__footerCol {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.PageIndex__footerNote {
  margin: 8px 0 0;
  font-size: 13px;
  color: rgba(69, 69, 69, 0.65);
}

.PageIndex__footerHead {
  font-size: 13px;
  font-weight: 700;
  color: $primary;
  margin-bottom: 4px;
  letter-spacing: 0.04em;
}

.PageIndex__footerLink {
  font-size: 13px;
  color: rgba(69, 69, 69, 0.78);
  text-decoration: none;
  transition: color 0.15s ease;
}

.PageIndex__footerLink:hover {
  color: $primary;
}

.PageIndex__footerBar {
  max-width: 1200px;
  margin: 32px auto 0;
  padding-top: 20px;
  border-top: 1px solid rgba(53, 77, 123, 0.08);
  text-align: center;
}

.PageIndex__footerCopy {
  font-size: 12px;
  color: rgba(69, 69, 69, 0.55);
}

// RWD ----
@include rwd-less(960px) {
  .PageIndex__navLinks {
    display: none;
  }

  .PageIndex__heroInner {
    grid-template-columns: 1fr;
    gap: 64px;
  }

  .PageIndex__heroTitle {
    font-size: 38px;
  }

  .PageIndex__heroVisual {
    height: 380px;
  }

  .PageIndex__modes {
    grid-template-columns: repeat(2, 1fr);
  }

  .PageIndex__features {
    grid-template-columns: repeat(2, 1fr);
  }

  .PageIndex__steps {
    grid-template-columns: 1fr;
  }

  .PageIndex__footerInner {
    grid-template-columns: 1fr 1fr;
  }
}

@include rwd-less(640px) {
  .PageIndex__navInner {
    padding: 0 16px;
  }

  .PageIndex__brandName {
    display: none;
  }

  .PageIndex__hero {
    padding: 48px 20px 72px;
  }

  .PageIndex__heroTitle {
    font-size: 30px;
  }

  .PageIndex__heroLead {
    font-size: 15px;
  }

  .PageIndex__heroVisual {
    height: 340px;
  }

  .PageIndex__heroCard--a {
    top: 0;
    left: 0;
    width: 180px;
  }

  .PageIndex__heroCard--b {
    top: 80px;
    right: 0;
    width: 180px;
  }

  .PageIndex__heroCard--c {
    bottom: 0;
    left: 20px;
    width: 260px;
  }

  .PageIndex__section {
    padding: 56px 20px;
  }

  .PageIndex__sectionTitle {
    font-size: 26px;
  }

  .PageIndex__modes,
  .PageIndex__features {
    grid-template-columns: 1fr;
  }

  .PageIndex__cta {
    padding: 56px 20px;
  }

  .PageIndex__ctaTitle {
    font-size: 24px;
  }

  .PageIndex__footerInner {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
</style>
