<script setup lang="ts">
// PageSignIn — 商家 / 平台管理員登入
// 用 ?type=merchant|admin 切換身份（預設 merchant）
import type { FormInstance, FormRules } from 'element-plus';

definePageMeta({ layout: 'default' });

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const storeSelf = StoreSelf();
const verify = UseVerify();

const signInType = computed<'merchant' | 'admin'>(() =>
  route.query.type === 'admin' ? 'admin' : 'merchant'
);

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const form = reactive({
  email: '',
  password: ''
});

const rules: FormRules = {
  email: [verify.mail.value],
  password: [verify.enter.value]
};

const isAdmin = computed(() => signInType.value === 'admin');

const heroCopy = computed(() => isAdmin.value
  ? {
      eyebrow: '平台管理員',
      title: '監理整個 SaaS 生態',
      lead: '管理商家審核、停權、平台管理員權限，掌握每個商家的狀態。',
      bullets: ['商家審核 / 停權', '管理員權限控制', '代理商家後台']
    }
  : {
      eyebrow: '商家登入',
      title: '歡迎回來，繼續經營你的預約',
      lead: '管理服務、資源、員工、排班與顧客預約，所有功能一站搞定。',
      bullets: ['即時預約管理', '智慧時段引擎', '專屬對外連結']
    }
);

const formTitle = computed(() => isAdmin.value ? '平台管理員登入' : '商家登入');
const formLead = computed(() => isAdmin.value
  ? '使用平台管理員 Email 與密碼登入。'
  : '使用註冊時的 Email 與密碼登入。'
);

// 測試帳號快速帶入（seed: prisma/seed-customer-booking.ts）
interface TestAccount {
  label: string;
  email: string;
  password: string;
  hint?: string;
}
const testAccounts = computed<TestAccount[]>(() => isAdmin.value
  ? [
      { label: '平台管理員', email: 'admin@demo.test', password: 'Password123' }
    ]
  : [
      { label: '商家 OWNER', email: 'owner@demo.test', password: 'Password123', hint: 'demo-clinic' }
    ]
);

const FillTestAccount = (account: TestAccount) => {
  form.email = account.email;
  form.password = account.password;
  formRef.value?.clearValidate();
};

const PickLocaleMessage = (msg: { zh_tw?: string; en?: string; ja?: string } | undefined): string =>
  msg?.zh_tw || msg?.en || msg?.ja || '操作失敗';

const ApiSignIn = async () => {
  const params = { email: form.email.trim(), password: form.password };
  return isAdmin.value
    ? await $api.SignInAdmin(params)
    : await $api.SignInMerchant(params);
};

const SignInFlow = async () => {
  submitting.value = true;
  try {
    const res = await ApiSignIn();
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(PickLocaleMessage(res.status.message));
      return;
    }
    const data = res.data as any;
    storeSelf.SetIdentity({
      token: data.token,
      type: data.type,
      role: data.role ?? '',
      merchantId: data.merchantId ?? '',
      userName: data.userName ?? '',
      userEmail: data.userEmail ?? ''
    });
    // 清除可能殘留的代理備份（避免登出後仍能還原舊 admin 身分）
    UseImpersonation().ClearBackup();
    ElMessage.success('登入成功');
    if (data.type === 'admin') {
      router.push(localePath('/sys'));
    } else {
      router.push(localePath('/admin'));
    }
  } finally {
    submitting.value = false;
  }
};

const ClickSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  await SignInFlow();
};
</script>

<template lang="pug">
.PageSignIn
  BizCustomerPageHeader(
    variant="overlay"
    :back-to="'/'"
    :back-label="$t('common.goHome')"
  )
  .PageSignIn__split
    //- 左側品牌區
    aside.PageSignIn__brand
      NuxtLinkLocale.PageSignIn__brandHeader(to="/")
        .PageSignIn__brandMark A
        .PageSignIn__brandName Appointment
      .PageSignIn__brandBody
        .PageSignIn__brandEyebrow {{ heroCopy.eyebrow }}
        h2.PageSignIn__brandTitle {{ heroCopy.title }}
        p.PageSignIn__brandLead {{ heroCopy.lead }}
        ul.PageSignIn__brandList
          li.PageSignIn__brandItem(v-for="b in heroCopy.bullets" :key="b") {{ b }}

    //- 右側表單區
    section.PageSignIn__panel
      .PageSignIn__panelInner
        header.PageSignIn__head
          h1.PageSignIn__title {{ formTitle }}
          p.PageSignIn__lead {{ formLead }}

        ElForm.PageSignIn__form(
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
          ElFormItem(label="密碼" prop="password")
            ElInput(
              v-model="form.password"
              type="password"
              maxlength="64"
              show-password
              autocomplete="current-password"
              placeholder="請輸入密碼"
              size="large"
            )
          .PageSignIn__testAccounts(v-if="testAccounts.length")
            .PageSignIn__testLabel 測試帳號快速帶入
            .PageSignIn__testList
              ElButton.PageSignIn__testBtn(
                v-for="acc in testAccounts"
                :key="acc.email"
                size="small"
                @click="FillTestAccount(acc)"
              )
                span.PageSignIn__testBtnLabel {{ acc.label }}
                span.PageSignIn__testBtnEmail {{ acc.email }}

          ElButton.PageSignIn__submit(
            type="primary"
            native-type="submit"
            :loading="submitting"
            size="large"
            @click="ClickSubmit"
          ) 登入

        .PageSignIn__links(v-if="!isAdmin")
          NuxtLinkLocale.PageSignIn__link(to="/sign-up") 立即註冊商家
          span.PageSignIn__divider |
          NuxtLinkLocale.PageSignIn__link(to="/forgot-password") 忘記密碼
</template>

<style lang="scss" scoped>
.PageSignIn {
  min-height: 100vh;
  background-color: $bg;
}

.PageSignIn__split {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
}

// 左側品牌區 ----
.PageSignIn__brand {
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

.PageSignIn__brand::before,
.PageSignIn__brand::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.04);
  pointer-events: none;
}

.PageSignIn__brand::before {
  width: 320px;
  height: 320px;
  top: -80px;
  right: -100px;
}

.PageSignIn__brand::after {
  width: 240px;
  height: 240px;
  bottom: -60px;
  left: -80px;
}

.PageSignIn__brandHeader {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: $white;
  width: fit-content;
}

.PageSignIn__brandMark {
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

.PageSignIn__brandName {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.PageSignIn__brandBody {
  position: relative;
  max-width: 460px;
}

.PageSignIn__brandEyebrow {
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

.PageSignIn__brandTitle {
  margin: 0 0 16px;
  font-size: 36px;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.005em;
}

.PageSignIn__brandLead {
  margin: 0 0 28px;
  font-size: 15px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.78);
}

.PageSignIn__brandList {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.PageSignIn__brandItem {
  position: relative;
  padding-left: 26px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}

.PageSignIn__brandItem::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, $secondary, $tertiary);
}

.PageSignIn__brandItem::after {
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
.PageSignIn__panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 32px;
  background-color: $white;
}

.PageSignIn__panelInner {
  width: 100%;
  max-width: 380px;
}

.PageSignIn__head {
  margin-bottom: 32px;
}

.PageSignIn__title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  color: $primary;
  letter-spacing: -0.005em;
}

.PageSignIn__lead {
  margin: 0;
  font-size: 14px;
  color: rgba(69, 69, 69, 0.65);
  line-height: 1.6;
}

.PageSignIn__form {
  margin-bottom: 8px;
}

.PageSignIn__testAccounts {
  margin-top: 8px;
  padding: 12px 14px;
  border: 1px dashed rgba(53, 77, 123, 0.25);
  border-radius: 10px;
  background-color: rgba(53, 77, 123, 0.04);
}

.PageSignIn__testLabel {
  font-size: 12px;
  font-weight: 600;
  color: rgba(69, 69, 69, 0.7);
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}

.PageSignIn__testList {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.PageSignIn__testBtn {
  height: auto;
  padding: 6px 12px;
  border-radius: 8px;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.3;
}

.PageSignIn__testBtnLabel {
  font-size: 12px;
  font-weight: 600;
  color: $primary;
}

.PageSignIn__testBtnEmail {
  font-size: 11px;
  color: rgba(69, 69, 69, 0.55);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.PageSignIn__submit {
  width: 100%;
  margin-top: 12px;
  border-radius: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.PageSignIn__links {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.PageSignIn__link {
  color: $primary;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.15s ease;
}

.PageSignIn__link:hover {
  color: $secondary;
}

.PageSignIn__divider {
  color: rgba(53, 77, 123, 0.25);
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
  .PageSignIn__split {
    grid-template-columns: 1fr;
  }

  .PageSignIn__brand {
    padding: 72px 28px 32px;
    min-height: 320px;
  }

  .PageSignIn__brandBody {
    margin: 16px 0;
  }

  .PageSignIn__brandTitle {
    font-size: 26px;
  }

  .PageSignIn__brandList {
    display: none;
  }
}

@include rwd-less(640px) {
  .PageSignIn__brand {
    padding: 68px 20px 28px;
    min-height: 260px;
  }

  .PageSignIn__brandTitle {
    font-size: 22px;
  }

  .PageSignIn__brandLead {
    font-size: 14px;
  }

  .PageSignIn__panel {
    padding: 32px 20px;
  }

  .PageSignIn__title {
    font-size: 22px;
  }
}
</style>
