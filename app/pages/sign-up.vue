<script setup lang="ts">
// PageSignUp — 商家自助註冊
// 成功後切到「待管理員審核」靜態畫面，不簽 token、不跳轉
import type { FormInstance, FormItemRule, FormRules } from 'element-plus';

definePageMeta({ layout: 'default' });

const verify = UseVerify();

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const pendingReview = ref(false);

const form = reactive({
  merchantName: '',
  email: '',
  password: '',
  passwordConfirm: ''
});

const passwordRule: FormItemRule = {
  required: true,
  trigger: 'change',
  validator: (_rule, value: string, callback) => {
    if (!value) return callback(new Error('請輸入密碼'));
    if (value.length < 8) return callback(new Error('密碼至少 8 碼'));
    if (!/[A-Za-z]/.test(value)) return callback(new Error('密碼需包含字母'));
    if (!/[0-9]/.test(value)) return callback(new Error('密碼需包含數字'));
    callback();
  }
};

const passwordConfirmRule: FormItemRule = {
  required: true,
  trigger: 'change',
  validator: (_rule, value: string, callback) => {
    if (!value) return callback(new Error('請再次輸入密碼'));
    if (value !== form.password) return callback(new Error('兩次密碼不一致'));
    callback();
  }
};

const rules: FormRules = {
  merchantName: [verify.enter.value],
  email: [verify.mail.value],
  password: [passwordRule],
  passwordConfirm: [passwordConfirmRule]
};

const brandBullets = [
  '免費註冊，無前期成本',
  '四種預約模式自由切換',
  '繁中／英／日內建支援'
];

const PickLocaleMessage = (msg: { zh_tw?: string; en?: string; ja?: string } | undefined): string =>
  msg?.zh_tw || msg?.en || msg?.ja || '操作失敗';

const SignUpFlow = async () => {
  submitting.value = true;
  try {
    const res = await $api.SignUpMerchant({
      email: form.email.trim(),
      password: form.password,
      merchantName: form.merchantName.trim()
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(PickLocaleMessage(res.status.message));
      return;
    }
    pendingReview.value = true;
  } finally {
    submitting.value = false;
  }
};

const ClickSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  await SignUpFlow();
};
</script>

<template lang="pug">
.PageSignUp
  BizCustomerPageHeader(
    variant="overlay"
    :back-to="'/'"
    :back-label="$t('common.goHome')"
  )
  .PageSignUp__split
    //- 左側品牌區
    aside.PageSignUp__brand
      NuxtLinkLocale.PageSignUp__brandHeader(to="/")
        .PageSignUp__brandMark A
        .PageSignUp__brandName Appointment
      .PageSignUp__brandBody
        .PageSignUp__brandEyebrow 加入平台
        h2.PageSignUp__brandTitle 開店第一步，從註冊開始
        p.PageSignUp__brandLead 完成註冊後，平台管理員會儘速審核您的申請，審核通過即可登入後台開始接受預約。
        ul.PageSignUp__brandList
          li.PageSignUp__brandItem(v-for="b in brandBullets" :key="b") {{ b }}

    //- 右側表單區
    section.PageSignUp__panel
      .PageSignUp__panelInner
        //- 註冊表單
        template(v-if="!pendingReview")
          header.PageSignUp__head
            h1.PageSignUp__title 商家註冊
            p.PageSignUp__lead 註冊送出後，需平台管理員審核通過才能登入。

          ElForm.PageSignUp__form(
            ref="formRef"
            :model="form"
            :rules="rules"
            label-position="top"
            @submit.prevent="ClickSubmit"
          )
            ElFormItem(label="商家名稱" prop="merchantName")
              ElInput(
                v-model="form.merchantName"
                maxlength="60"
                placeholder="請輸入商家名稱"
                size="large"
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
            ElFormItem(label="密碼" prop="password")
              ElInput(
                v-model="form.password"
                type="password"
                maxlength="64"
                show-password
                autocomplete="new-password"
                placeholder="至少 8 碼，含字母與數字"
                size="large"
              )
            ElFormItem(label="確認密碼" prop="passwordConfirm")
              ElInput(
                v-model="form.passwordConfirm"
                type="password"
                maxlength="64"
                show-password
                autocomplete="new-password"
                placeholder="再次輸入密碼"
                size="large"
              )
            ElButton.PageSignUp__submit(
              type="primary"
              native-type="submit"
              :loading="submitting"
              size="large"
              @click="ClickSubmit"
            ) 送出申請

          .PageSignUp__links
            span.PageSignUp__hint 已有帳號？
            NuxtLinkLocale.PageSignUp__link(to="/sign-in") 返回登入

        //- 待審核成功畫面
        template(v-else)
          .PageSignUp__notice
            .PageSignUp__noticeIcon
              span.PageSignUp__noticeCheck
            h2.PageSignUp__noticeTitle 申請已送出
            p.PageSignUp__noticeBody 您的商家註冊申請已送出，請等待平台管理員審核。<br/>審核通過後將以 Email 通知您登入後台。
            NuxtLinkLocale.PageSignUp__noticeBtn(to="/sign-in")
              ElButton(type="primary" size="large") 返回登入
</template>

<style lang="scss" scoped>
.PageSignUp {
  min-height: 100vh;
  background-color: $bg;
}

.PageSignUp__split {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
}

// 左側品牌區 ----
.PageSignUp__brand {
  position: relative;
  padding: 80px 56px 48px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  color: $white;
  background:
    radial-gradient(600px 400px at 90% -10%, rgba(235, 139, 45, 0.35), transparent 60%),
    radial-gradient(700px 500px at -10% 110%, rgba(0, 173, 169, 0.35), transparent 60%),
    linear-gradient(135deg, $primary 0%, #2a3d62 60%, #1d2c4a 100%);
  overflow: hidden;
}

.PageSignUp__brand::before,
.PageSignUp__brand::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.04);
  pointer-events: none;
}

.PageSignUp__brand::before {
  width: 320px;
  height: 320px;
  top: -80px;
  right: -100px;
}

.PageSignUp__brand::after {
  width: 240px;
  height: 240px;
  bottom: -60px;
  left: -80px;
}

.PageSignUp__brandHeader {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: $white;
  width: fit-content;
}

.PageSignUp__brandMark {
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

.PageSignUp__brandName {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.PageSignUp__brandBody {
  position: relative;
  max-width: 460px;
}

.PageSignUp__brandEyebrow {
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

.PageSignUp__brandTitle {
  margin: 0 0 16px;
  font-size: 36px;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.005em;
}

.PageSignUp__brandLead {
  margin: 0 0 28px;
  font-size: 15px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.78);
}

.PageSignUp__brandList {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.PageSignUp__brandItem {
  position: relative;
  padding-left: 26px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}

.PageSignUp__brandItem::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, $secondary, $tertiary);
}

.PageSignUp__brandItem::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 10px;
  width: 8px;
  height: 5px;
  border-left: 2px solid $white;
  border-bottom: 2px solid $white;
  transform: rotate(-45deg);
}

// 右側表單區 ----
.PageSignUp__panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 32px;
  background-color: $white;
}

.PageSignUp__panelInner {
  width: 100%;
  max-width: 420px;
}

.PageSignUp__head {
  margin-bottom: 28px;
}

.PageSignUp__title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  color: $primary;
  letter-spacing: -0.005em;
}

.PageSignUp__lead {
  margin: 0;
  font-size: 14px;
  color: rgba(69, 69, 69, 0.65);
  line-height: 1.6;
}

.PageSignUp__form {
  margin-bottom: 8px;
}

.PageSignUp__submit {
  width: 100%;
  margin-top: 12px;
  border-radius: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.PageSignUp__links {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.PageSignUp__hint {
  color: rgba(69, 69, 69, 0.6);
}

.PageSignUp__link {
  color: $primary;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.15s ease;
}

.PageSignUp__link:hover {
  color: $secondary;
}

// 成功狀態 ----
.PageSignUp__notice {
  text-align: center;
  padding: 16px 0;
}

.PageSignUp__noticeIcon {
  width: 72px;
  height: 72px;
  margin: 0 auto 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, $secondary, #5fc6c3);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 30px -10px rgba(0, 173, 169, 0.5);
}

.PageSignUp__noticeCheck {
  width: 26px;
  height: 14px;
  border-left: 3px solid $white;
  border-bottom: 3px solid $white;
  transform: rotate(-45deg);
  margin-top: -6px;
}

.PageSignUp__noticeTitle {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 700;
  color: $primary;
}

.PageSignUp__noticeBody {
  margin: 0 0 28px;
  font-size: 14px;
  line-height: 1.7;
  color: rgba(69, 69, 69, 0.7);
}

.PageSignUp__noticeBtn {
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
  .PageSignUp__split {
    grid-template-columns: 1fr;
  }

  .PageSignUp__brand {
    padding: 72px 28px 32px;
    min-height: 320px;
  }

  .PageSignUp__brandBody {
    margin: 16px 0;
  }

  .PageSignUp__brandTitle {
    font-size: 26px;
  }

  .PageSignUp__brandList {
    display: none;
  }
}

@include rwd-less(640px) {
  .PageSignUp__brand {
    padding: 68px 20px 28px;
    min-height: 260px;
  }

  .PageSignUp__brandTitle {
    font-size: 22px;
  }

  .PageSignUp__brandLead {
    font-size: 14px;
  }

  .PageSignUp__panel {
    padding: 32px 20px;
  }

  .PageSignUp__title {
    font-size: 22px;
  }
}
</style>
