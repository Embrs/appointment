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
  .PageSignUp__card
    //- 註冊表單
    template(v-if="!pendingReview")
      h1.PageSignUp__title 商家註冊
      p.PageSignUp__hint 註冊送出後，需平台管理員審核通過才能登入

      ElForm(
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
          )
        ElFormItem(label="Email" prop="email")
          ElInput(
            v-model="form.email"
            type="email"
            maxlength="120"
            autocomplete="email"
            placeholder="example@domain.com"
          )
        ElFormItem(label="密碼" prop="password")
          ElInput(
            v-model="form.password"
            type="password"
            maxlength="64"
            show-password
            autocomplete="new-password"
            placeholder="至少 8 碼，含字母與數字"
          )
        ElFormItem(label="確認密碼" prop="passwordConfirm")
          ElInput(
            v-model="form.passwordConfirm"
            type="password"
            maxlength="64"
            show-password
            autocomplete="new-password"
            placeholder="再次輸入密碼"
          )
        ElButton.PageSignUp__submit(
          type="primary"
          native-type="submit"
          :loading="submitting"
          @click="ClickSubmit"
        ) 送出申請

      .PageSignUp__links
        NuxtLink.PageSignUp__link(to="/sign-in") 已有帳號？返回登入

    //- 待審核成功畫面
    template(v-else)
      .PageSignUp__notice
        h2.PageSignUp__noticeTitle 申請已送出
        p.PageSignUp__noticeBody 您的商家註冊申請已送出，請等待平台管理員審核。審核通過後即可登入後台。
        NuxtLink.PageSignUp__noticeBtn(to="/sign-in")
          ElButton(type="primary") 返回登入
</template>

<style lang="scss" scoped>
.PageSignUp {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: #f5f7fa;
}

.PageSignUp__card {
  width: 100%;
  max-width: 420px;
  background-color: #fff;
  border-radius: 8px;
  padding: 32px 28px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.PageSignUp__title {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  color: #303133;
}

.PageSignUp__hint {
  margin: 0 0 24px 0;
  font-size: 13px;
  color: #909399;
  text-align: center;
}

.PageSignUp__submit {
  width: 100%;
  margin-top: 8px;
}

.PageSignUp__links {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  font-size: 13px;
}

.PageSignUp__link {
  color: #409eff;
  text-decoration: none;
}

.PageSignUp__link:hover {
  text-decoration: underline;
}

.PageSignUp__notice {
  text-align: center;
}

.PageSignUp__noticeTitle {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #67c23a;
}

.PageSignUp__noticeBody {
  margin: 0 0 24px 0;
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
}

.PageSignUp__noticeBtn {
  display: inline-block;
}
</style>
