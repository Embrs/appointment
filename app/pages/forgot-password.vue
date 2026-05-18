<script setup lang="ts">
// PageForgotPassword — 忘記密碼
// MVP 不寄信，固定顯示通用成功訊息，避免 email 列舉
import type { FormInstance, FormRules } from 'element-plus';

definePageMeta({ layout: 'default' });

const verify = UseVerify();

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const submitted = ref(false);
const form = reactive({ email: '' });

const rules: FormRules = {
  email: [verify.mail.value]
};

const ForgotFlow = async () => {
  submitting.value = true;
  try {
    await $api.ForgotPassword({ email: form.email.trim() });
    // 不論結果一律顯示通用訊息，避免帳號列舉
    submitted.value = true;
  } finally {
    submitting.value = false;
  }
};

const ClickSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  await ForgotFlow();
};
</script>

<template lang="pug">
.PageForgotPassword
  BizCustomerPageHeader(
    variant="overlay"
    :back-to="'/sign-in'"
    :back-label="$t('common.backToSignIn')"
  )
  .PageForgotPassword__split
    //- 左側品牌區
    aside.PageForgotPassword__brand
      NuxtLink.PageForgotPassword__brandHeader(to="/")
        .PageForgotPassword__brandMark A
        .PageForgotPassword__brandName Appointment
      .PageForgotPassword__brandBody
        .PageForgotPassword__brandEyebrow 密碼救援
        h2.PageForgotPassword__brandTitle 忘記密碼？沒關係，我們幫您
        p.PageForgotPassword__brandLead 輸入註冊時的 Email，若帳號存在，我們將寄送密碼重設連結到您的信箱。
      .PageForgotPassword__brandFooter
        NuxtLink.PageForgotPassword__brandBack(to="/sign-in") ← {{ $t('common.backToSignIn') }}

    //- 右側表單區
    section.PageForgotPassword__panel
      .PageForgotPassword__panelInner
        template(v-if="!submitted")
          header.PageForgotPassword__head
            h1.PageForgotPassword__title 忘記密碼
            p.PageForgotPassword__lead 輸入帳號 Email，若帳號存在我們會寄送重設連結。

          ElForm.PageForgotPassword__form(
            ref="formRef"
            :model="form"
            :rules="rules"
            label-position="top"
            @submit.prevent="ClickSubmit"
          )
            ElFormItem(label="Email" prop="email")
              ElInput(
                v-model="form.email"
                type="email"
                maxlength="120"
                autocomplete="email"
                placeholder="example@domain.com"
                size="large"
              )
            ElButton.PageForgotPassword__submit(
              type="primary"
              native-type="submit"
              :loading="submitting"
              size="large"
              @click="ClickSubmit"
            ) 送出重設連結

          .PageForgotPassword__links
            NuxtLink.PageForgotPassword__link(to="/sign-in") ← 返回登入

        template(v-else)
          .PageForgotPassword__notice
            .PageForgotPassword__noticeIcon
              span.PageForgotPassword__noticeMail
            h2.PageForgotPassword__noticeTitle 已送出重設連結
            p.PageForgotPassword__noticeBody 若該 Email 存在於本平台，您將很快收到密碼重設信件。<br/>請檢查收件匣或垃圾信件夾。
            NuxtLink.PageForgotPassword__noticeBtn(to="/sign-in")
              ElButton(type="primary" size="large") 返回登入
</template>

<style lang="scss" scoped>
.PageForgotPassword {
  min-height: 100vh;
  background-color: $bg;
}

.PageForgotPassword__split {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
}

// 左側品牌區 ----
.PageForgotPassword__brand {
  position: relative;
  padding: 48px 56px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: $white;
  background:
    radial-gradient(600px 400px at 90% -10%, rgba(235, 139, 45, 0.35), transparent 60%),
    radial-gradient(700px 500px at -10% 110%, rgba(0, 173, 169, 0.35), transparent 60%),
    linear-gradient(135deg, $primary 0%, #2a3d62 60%, #1d2c4a 100%);
  overflow: hidden;
}

.PageForgotPassword__brand::before,
.PageForgotPassword__brand::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.04);
  pointer-events: none;
}

.PageForgotPassword__brand::before {
  width: 320px;
  height: 320px;
  top: -80px;
  right: -100px;
}

.PageForgotPassword__brand::after {
  width: 240px;
  height: 240px;
  bottom: -60px;
  left: -80px;
}

.PageForgotPassword__brandHeader {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: $white;
  width: fit-content;
}

.PageForgotPassword__brandMark {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, $secondary, $tertiary);
  color: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
}

.PageForgotPassword__brandName {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.PageForgotPassword__brandBody {
  position: relative;
  max-width: 460px;
}

.PageForgotPassword__brandEyebrow {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  margin-bottom: 20px;
}

.PageForgotPassword__brandTitle {
  margin: 0 0 16px;
  font-size: 36px;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.005em;
}

.PageForgotPassword__brandLead {
  margin: 0;
  font-size: 15px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.78);
}

.PageForgotPassword__brandFooter {
  position: relative;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.PageForgotPassword__brandBack {
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: color 0.15s ease;
}

.PageForgotPassword__brandBack:hover {
  color: $white;
}

// 右側表單區 ----
.PageForgotPassword__panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 32px;
  background-color: $white;
}

.PageForgotPassword__panelInner {
  width: 100%;
  max-width: 380px;
}

.PageForgotPassword__head {
  margin-bottom: 32px;
}

.PageForgotPassword__title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  color: $primary;
  letter-spacing: -0.005em;
}

.PageForgotPassword__lead {
  margin: 0;
  font-size: 14px;
  color: rgba(69, 69, 69, 0.65);
  line-height: 1.6;
}

.PageForgotPassword__form {
  margin-bottom: 8px;
}

.PageForgotPassword__submit {
  width: 100%;
  margin-top: 12px;
  border-radius: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.PageForgotPassword__links {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  font-size: 13px;
}

.PageForgotPassword__link {
  color: $primary;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.15s ease;
}

.PageForgotPassword__link:hover {
  color: $secondary;
}

// 成功狀態 ----
.PageForgotPassword__notice {
  text-align: center;
  padding: 16px 0;
}

.PageForgotPassword__noticeIcon {
  width: 72px;
  height: 72px;
  margin: 0 auto 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, $tertiary, #f0a85d);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 30px -10px rgba(235, 139, 45, 0.5);
}

.PageForgotPassword__noticeMail {
  width: 28px;
  height: 20px;
  border: 2px solid $white;
  border-radius: 3px;
  position: relative;
}

.PageForgotPassword__noticeMail::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background:
    linear-gradient(to bottom right, transparent calc(50% - 1px), $white calc(50% - 1px), $white calc(50% + 1px), transparent calc(50% + 1px)),
    linear-gradient(to bottom left, transparent calc(50% - 1px), $white calc(50% - 1px), $white calc(50% + 1px), transparent calc(50% + 1px));
}

.PageForgotPassword__noticeTitle {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 700;
  color: $primary;
}

.PageForgotPassword__noticeBody {
  margin: 0 0 28px;
  font-size: 14px;
  line-height: 1.7;
  color: rgba(69, 69, 69, 0.7);
}

.PageForgotPassword__noticeBtn {
  display: inline-block;
}

// 表單細節 ----
:deep(.el-form-item__label) {
  font-weight: 600;
  color: $font;
}

:deep(.el-input__wrapper) {
  border-radius: 10px;
  padding: 4px 14px;
}

:deep(.el-input--large .el-input__wrapper) {
  box-shadow: 0 0 0 1px rgba(53, 77, 123, 0.15) inset;
}

:deep(.el-input--large .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px rgba(53, 77, 123, 0.35) inset;
}

:deep(.el-input--large.is-focus .el-input__wrapper),
:deep(.el-input--large .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px $primary inset;
}

// RWD ----
@include rwd-less(960px) {
  .PageForgotPassword__split {
    grid-template-columns: 1fr;
  }

  .PageForgotPassword__brand {
    padding: 32px 28px;
    min-height: 280px;
  }

  .PageForgotPassword__brandBody {
    margin: 16px 0;
  }

  .PageForgotPassword__brandTitle {
    font-size: 26px;
  }

  .PageForgotPassword__brandFooter {
    display: none;
  }
}

@include rwd-less(640px) {
  .PageForgotPassword__brand {
    padding: 28px 20px;
    min-height: 220px;
  }

  .PageForgotPassword__brandTitle {
    font-size: 22px;
  }

  .PageForgotPassword__brandLead {
    font-size: 14px;
  }

  .PageForgotPassword__panel {
    padding: 32px 20px;
  }

  .PageForgotPassword__title {
    font-size: 22px;
  }
}
</style>
